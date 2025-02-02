import { expect } from 'chai';
import express from 'express';
import {
    requestAsBrowser,
    REQUEST_AS_BROWSER_DEFAULT_OPTIONS,
    FIREFOX_MOBILE_USER_AGENT,
    FIREFOX_DESKTOP_USER_AGENT,
} from '../build/utils_request';
import { startExpressAppPromise } from './_helper';

const CONTENT = 'CONTENT';
const HOST = '127.0.0.1';

describe('Apify.utils_request', () => {
    let mochaListener;
    let port;
    let server;
    before(async () => {
        mochaListener = process.listeners('uncaughtException').shift();
        process.removeListener('uncaughtException', mochaListener);
        const app = express();

        app.get('/406', (req, res) => {
            res.setHeader('content-type', 'text/html; charset=utf-8');
            res.status(406);
            res.send(CONTENT);
        });

        app.get('/echo', (req, res) => {
            res.send(JSON.stringify(req.headers));
        });

        app.get('/rawHeaders', (req, res) => {
            res.send(JSON.stringify(req.rawHeaders));
        });

        app.get('/invalidContentType', (req, res) => {
            res.setHeader('content-type', 'application/json');
            res.send(CONTENT);
        });

        app.get('/invalidContentHeader', (req, res) => {
            res.setHeader('Content-Type', 'non-existent-content-type');
            res.send(CONTENT);
        });

        app.get('/invalidBody', async (req, res) => {
            res.setHeader('content-encoding', 'deflate');
            res.status(500);
            res.send(Buffer.from(CONTENT, 'utf8'));
        });

        app.get('/empty', async (req, res) => {
            res.setHeader('Content-Type', 'text/html; charset=utf-8');
            res.send();
        });

        server = await startExpressAppPromise(app, 0);
        port = server.address().port; //eslint-disable-line
    });

    describe('Apify.requestAsBrowser', async () => {
        it('it uses mobile user-agent whe mobile property is set to true ', async () => {
            const data = {
                url: `http://${HOST}:${port}/echo`,
                useMobileVersion: true,
            };
            const response = await requestAsBrowser(data);
            expect(response.statusCode).to.eql(200);
            expect(JSON.parse(response.body)['user-agent']).to.be.eql(FIREFOX_MOBILE_USER_AGENT);
        });

        it('uses desktop user-agent by default ', async () => {
            const data = {
                url: `http://${HOST}:${port}/echo`,
            };
            const response = await requestAsBrowser(data);
            expect(response.statusCode).to.eql(200);
            expect(JSON.parse(response.body)['user-agent'])
                .to
                .be
                .eql(FIREFOX_DESKTOP_USER_AGENT);
        });

        it('sets correct hosts', async () => {
            const host = `${HOST}:${port}`;
            const options = {
                url: `http://${host}/echo`,
            };

            const response = await requestAsBrowser(options);

            expect(response.statusCode).to.eql(200);
            expect(JSON.parse(response.body).host).to.be.eql(host);
        });

        it('uses correct default language', async () => {
            const { languageCode, countryCode } = REQUEST_AS_BROWSER_DEFAULT_OPTIONS;
            const host = `${HOST}:${port}`;
            const options = {
                url: `http://${host}/echo`,
            };

            const response = await requestAsBrowser(options);

            expect(response.statusCode).to.eql(200);
            expect(JSON.parse(response.body)['accept-language']).to.be.eql(`${languageCode}-${countryCode},${languageCode};q=0.5`);
        });

        it('throws error for 406', async () => {
            const options = {
                url: `http://${HOST}:${port}/406`,
            };
            let error;
            try {
                await requestAsBrowser(options);
            } catch (e) {
                error = e;
            }

            expect(error).to.exist; //eslint-disable-line
            expect(error.message).to.eql(`Request for ${options.url} aborted due to abortFunction`);
        });

        it('does not throw for empty response body', async () => {
            const options = {
                url: `http://${HOST}:${port}/empty`,
            };
            let error;
            try {
                await requestAsBrowser(options);
            } catch (e) {
                error = e;
            }

            expect(error).to.not.exist; //eslint-disable-line
        });

        it('throws for other contentType then - text/html', async () => {
            const options = {
                url: `http://${HOST}:${port}/invalidContentType`,
            };
            let error;
            try {
                await requestAsBrowser(options);
            } catch (e) {
                error = e;
            }

            expect(error).to.exist; //eslint-disable-line
            expect(error.message).to.eql(`Request for ${options.url} aborted due to abortFunction`);
        });

        it('overrides defaults', async () => {
            const host = `${HOST}:${port}`;
            const options = {
                url: `http://${host}/echo`,
                headers: {
                    'User-Agent': 'chrome',
                },
            };

            const response = await requestAsBrowser(options);

            expect(response.statusCode).to.eql(200);
            expect(JSON.parse(response.body)['user-agent']).to.be.eql(options.headers['User-Agent']);
        });

        it('headers has same format as in firefox', async () => {
            const host = `${HOST}:${port}`;
            const options = {
                url: `http://${host}/rawHeaders`,
            };

            const response = await requestAsBrowser(options);
            const headersArray = JSON.parse(response.body);
            expect(response.statusCode).to.eql(200);


            expect(headersArray[0]).to.be.eql('User-Agent');
            expect(headersArray[1]).to.be.eql(FIREFOX_DESKTOP_USER_AGENT);
            expect(headersArray[2]).to.be.eql('Host');
            expect(headersArray[3]).to.be.eql(host);
            expect(headersArray[4]).to.be.eql('Accept');
            expect(headersArray[5]).to.be.eql('text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8');
            expect(headersArray[6]).to.be.eql('Accept-Language');
            expect(headersArray[7]).to.be.eql('en-US,en;q=0.5');
            expect(headersArray[8]).to.be.eql('Accept-Encoding');
            expect(headersArray[9]).to.be.eql('gzip, deflate, br');
            expect(headersArray[10]).to.be.eql('Connection');
            expect(headersArray[11]).to.be.eql('keep-alive');
        });
    });
});
