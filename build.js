/* eslint-env node */
'use strict';

const { promisify } = require('util');
const { map } = require('async');
const path = require('path');
const fs = require('fs');
const readFileAsync = promisify(fs.readFile);
const area = require('@turf/area');
const { featureCollection } = require('@turf/helpers');
const combine = require('@turf/combine');
const truncate = require('@turf/truncate');
const beautify = require('js-beautify');

async function main() {
	const protectorateDir = path.resolve(__dirname, './protectorates');
	const protectorates = fs.readdirSync(protectorateDir);

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

		protectorates.sort(function(a, b) {
			return area(a) > area(b) ? -1 : 1;
		});

		const protectorateFeatures = protectorates.map((protectorate) => protectorate.features);
		const merged = featureCollection([].concat(...protectorateFeatures));
		const trimmed = truncate(merged, 3);

		const beautified = beautify(JSON.stringify(trimmed), {
			'indent_with_tabs': true,
			'brace_style': 'end-expand'
		});

		const outFile = path.resolve(__dirname, './peerage.geojson');
		fs.writeFileSync(outFile, beautified);
	});
}

main();
