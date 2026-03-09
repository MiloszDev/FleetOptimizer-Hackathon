import { defineConfig } from '@hey-api/openapi-ts';

export default defineConfig({
	input: '../shared/openapi.json',
	output: './src/lib/api-client',
	plugins: [
		{
			name: '@tanstack/react-query',
			queryOptions: true,
			queryKeys: true,
			mutationOptions: true,
		},
	],
});

