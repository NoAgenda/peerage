'use strict';
require('dotenv').config();
const { promisify } = require('util');
const path = require('path');
const { readFile, writeFile } = require('fs');
const got = require('got');
const imagemin = require('imagemin');
const imageminAdvpng = require('imagemin-advpng');
const imageminPngcrush = require('imagemin-pngcrush');
const Listr = require('listr');
const puppeteer = require('puppeteer');

const readFileAsync = promisify(readFile);
const writeFileAsync = promisify(writeFile);

async function createGist(filename, contents, description = 'A Gist') {
	const json = {
		description,
		public: false,
		files: {
			[filename]: {
				content: `${contents}`
			}
		}
	};

	const response = await got.post('https://api.github.com/gists', {
		body: json,
		json: true,
		headers: {
			Authorization: `token ${process.env.GIST_TOKEN}`
		}
	});

	return {
		api: response.body.url,
		html: response.body.html_url
	};
}

async function deleteGist(url) {
	return got.delete(url, {
		headers: {
			Authorization: `token ${process.env.GIST_TOKEN}`
		}
	});
}

async function getIframeUrl(gistUrl) {
	const url = `${gistUrl}.js`;
	const response = await got(url);
	const matches = response.body.match(/<iframe class=\\"render-viewer\s?\\" src=\\"(.*)\\" sandbox/);

	if (matches) {
		return matches[1];
	}

	return null;
}

async function takeScreenshot(url, width = 1024, height = 768) {
	const browser = await puppeteer.launch();
	const page = await browser.newPage();

	await page.setViewport({
		width,
		height,
		deviceScaleFactor: 2
	});

	await page.goto(url, {
		waitUntil: ['load', 'networkidle0']
	});

	await page.addStyleTag({
		content: `
			.is-embedded .render-shell {
				border: 0;
			}

			.render-bar,
			.leaflet-top.leaflet-left,
			.mapbox-improve-map {
				display: none !important;
			}
		`
	});

	const screenshot = await page.screenshot();
	await browser.close();

	return screenshot;
}

async function optimizeImage(buffer) {
	return imagemin.buffer(buffer, {
		plugins: [
			imageminPngcrush({ reduce: true }),
			imageminAdvpng({ optimizationLevel: 4 })
		]
	});
}

(async () => {
	const peerage = await readFileAsync(path.resolve(__dirname, 'peerage.geojson'));

	const tasks = new Listr([
		{
			title: 'Creating gist',
			task: async (ctx) => {
				ctx.urls = await createGist('peerage.geojson', peerage, 'No Agenda Peerage Map');
			}
		},
		{
			title: 'Taking screenshot',
			task: async (ctx) => {
				const screenshotUrl = await getIframeUrl(ctx.urls.html);
				ctx.image = await takeScreenshot(screenshotUrl, 1400, 800);
			}
		},
		{
			title: 'Optimizing screenshot',
			enabled: () => !process.env.SKIP_OPTIMIZATION,
			task: async (ctx) => {
				ctx.image = await optimizeImage(ctx.image);
			}
		},
		{
			title: 'Writing screenshot',
			task: async (ctx) => writeFileAsync('map.png', ctx.image)
		},
		{
			title: 'Deleting gist',
			task: async (ctx) => {
				await deleteGist(ctx.urls.api);
				console.log('done deleting');
			}
		}
	]);

	return tasks.run();
})();
