'use strict';
const { promisify } = require('util');
const path = require('path');
const { readFile, writeFile } = require('fs');
const got = require('got');
const imagemin = require('imagemin');
const imageminAdvpng = require('imagemin-advpng');
const imageminPngcrush = require('imagemin-pngcrush');
const Listr = require('listr');
const opn = require('opn');
const screenshot = require('electron-screenshot-service');

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
		json: true
	});

	return {
		api: response.body.url,
		html: response.body.html_url
	};
}

async function getIframeUrl(gistUrl) {
	const url = `${gistUrl}.js`;
	const response = await got(url);
	const matches = response.body.match(/<iframe class=\\"render-viewer\\" src=\\"(.*)\\" sandbox/);

	if (matches) {
		return matches[1];
	}

	return null;
}

async function takeScreenshot(url, width = 1024, height = 768) {
	try {
		const img = await screenshot({
			url,
			width,
			height,
			delay: 5000,
			css: `
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

		screenshot.close();
		return img.data;
	}
	catch (err) {
		screenshot.close();
		return null;
	}
}

async function optimizeImage(buffer) {
	return imagemin.buffer(buffer, {
		plugins: [
			imageminPngcrush({ reduce: true }),
			imageminAdvpng({ optimizationLevel: 4 })
		]
	});
}

async function main() {
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
			task: async (ctx) => {
				const optimizedImage = await optimizeImage(ctx.image);
				return writeFileAsync('map.png', optimizedImage);
			}
		},
		{
			title: 'Opening gist to delete',
			task: async (ctx) => opn(ctx.urls.html, {
				wait: false
			})
		}
	]);

	await tasks.run();
	console.log('');
}

main();
