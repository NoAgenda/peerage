'use strict';
const { promisify } = require('util');
const path = require('path');
const { readFile, writeFile } = require('fs');
const got = require('got');
const screenshot = require('electron-screenshot-service');
const imagemin = require('imagemin');
const imageminAdvpng = require('imagemin-advpng');
const imageminPngcrush = require('imagemin-pngcrush');

const readFileAsync = promisify(readFile);
const writeFileAsync = promisify(writeFile);

const createGist = async (filename, contents, description = 'A Gist') => {
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
};

const deleteGist = async (url) => {
	await got.delete(url);
};

const getIframeUrl = async (gistUrl) => {
	const url = `${gistUrl}.js`;
	const response = await got(url);
	const matches = response.body.match(/<iframe class=\\"render-viewer\\" src=\\"(.*)\\" sandbox/);

	if (matches) {
		return matches[1];
	}

	return null;
};

const takeScreenshot = async (url, width = 1024, height = 768) => {
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
	} catch (err) {
		screenshot.close();
		return null;
	}
};

const optimizeImage = async (buffer) => {
	return imagemin.buffer(buffer, {
		plugins: [
			imageminPngcrush({ reduce: true }),
			imageminAdvpng({ optimizationLevel: 4 })
		]
	});
};

async function main() {
	const peerage = await readFileAsync(path.resolve(__dirname, 'peerage.geojson'));

	console.log('Creating gist...');
	const urls = await createGist('peerage.geojson', peerage, 'No Agenda Peerage Map');

	console.log('Taking screenshot...');
	const screenshotUrl = await getIframeUrl(urls.html);
	const image = await takeScreenshot(screenshotUrl, 1400, 800);

	console.log('Optimizing screenshot...');
	const optimizedImage = await optimizeImage(image);
	await writeFileAsync('map.png', optimizedImage);

	try {
		console.log('Cleaning up...');
		await deleteGist(urls.api);
	}
	catch (err) {
		console.log(`Couldn’t delete gist, please delete manually: ${urls.html}`);
	}
}

main();
