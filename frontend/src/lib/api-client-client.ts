import { createClient } from './api-client/client';
import { API_URL } from '@/utils/env';

/**
 * Configured API client with base URL
 * This file is NOT generated - it's a manual configuration
 */
export const apiClient = createClient({
	baseUrl: API_URL,
});

