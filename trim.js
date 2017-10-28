/* eslint-env node */
'use strict';

const { promisify } = require('util');
const { each } = require('async');
const path = require('path');
const fs = require('fs');
const readFileAsync = promisify(fs.readFile);
const writeFileAsync = promisify(fs.writeFile);
const truncate = require('@turf/truncate');
const beautify = require('js-beautify');

async function main() {
	const protectorateDir = path.resolve(__dirname, './protectorates');
	const protectorates = fs.readdirSync(protectorateDir);

	each(protectorates, async (file) => {
		try {
			file = path.resolve(__dirname, './protectorates', file);

			const data = await readFileAsync(file);
			const json = JSON.parse(data);
			const trimmed = truncate(json, 3);

			const beautified = beautify(JSON.stringify(trimmed), {
				'indent_with_tabs': true,
				'brace_style': 'end-expand'
			});

			await writeFileAsync(file, beautified);
		}
		catch (err) {
			console.log('error with', file, err);
		}
	}, (err) => {
		console.log('done!', err);
	});
}

main();
