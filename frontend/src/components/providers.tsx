"use client";
import { getQueryClient } from "@/utils/query-client";
import { QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import type * as React from "react";
import WindowManager from "./window-manager";
import { VehicleNavigationProvider } from "@/lib/vehicle-navigation-context";
import { TrackingWebSocketProvider } from "@/lib/tracking-websocket-context";

export default function Providers({ children }: { children: React.ReactNode }) {
	const queryClient = getQueryClient();

	return (
		<QueryClientProvider client={queryClient}>
			<TrackingWebSocketProvider>
				<VehicleNavigationProvider>
					{children}
					<WindowManager />
				</VehicleNavigationProvider>
			</TrackingWebSocketProvider>
			<ReactQueryDevtools />
		</QueryClientProvider>
	);
}
