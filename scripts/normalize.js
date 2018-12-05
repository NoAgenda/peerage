'use strict';

const { promisify } = require('util');
const path = require('path');
const { readFile, writeFile, readdirSync } = require('fs');
const { each } = require('async');
const beautify = require('js-beautify');
const rewind = require('@turf/rewind');
const truncate = require('@turf/truncate');

const readFileAsync = promisify(readFile);
const writeFileAsync = promisify(writeFile);

async function main() {
	const protectorateDir = path.resolve(__dirname, '../protectorates');
	const protectorates = readdirSync(protectorateDir).map((file) => {
		return path.resolve(__dirname, '../protectorates', file);
	});

	each(protectorates, async (file) => {
		const data = await readFileAsync(file);
		const json = JSON.parse(data);

		const truncated = truncate(json);
		const rewinded = rewind(truncated);

		const beautified = beautify(JSON.stringify(rewinded), {
			indent_with_tabs: true, // eslint-disable-line camelcase
			brace_style: 'end-expand' // eslint-disable-line camelcase
		});

		await writeFileAsync(file, beautified);
	}, (err) => {
		console.log('done!', err);
	});
}

main();
