'use strict';

const { promisify } = require('util');
const path = require('path');
const { readFile, readdirSync, writeFileSync } = require('fs');
const { map } = require('async');
const area = require('@turf/area');
const { featureCollection } = require('@turf/helpers');
const truncate = require('@turf/truncate');
const beautify = require('js-beautify');

const readFileAsync = promisify(readFile);

async function main() {
	const protectorateDir = path.resolve(__dirname, '../protectorates');
	const protectorates = readdirSync(protectorateDir);

	map(protectorates, async (file) => {
		file = path.resolve(protectorateDir, file);

		const data = await readFileAsync(file);
		const json = JSON.parse(data);

		return json;
	}, (err, protectorates) => {
		if (err) {
			console.error(err);
			return;
		}

		protectorates.sort((a, b) => {
			return area(a) > area(b) ? -1 : 1;
		});

		const protectorateFeatures = protectorates.map((protectorate) => protectorate.features);
		const merged = featureCollection([].concat(...protectorateFeatures));
		const trimmed = truncate(merged, {
			precision: 3
		});

		const beautified = beautify(JSON.stringify(trimmed), {
			indent_with_tabs: true, // eslint-disable-line camelcase
			brace_style: 'end-expand' // eslint-disable-line camelcase
		});

		const outFile = path.resolve(__dirname, '../peerage.geojson');
		writeFileSync(outFile, beautified);
	});
}

main();
