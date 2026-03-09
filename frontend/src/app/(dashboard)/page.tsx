import { getQueryClient } from "@/utils/query-client";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { getVehicleCountApiVehiclesCountGetOptions } from "@/lib/api-client/@tanstack/react-query.gen";
import { apiClient } from "@/lib/api-client-client";
import DashboardClient from "./dashboard-client";

export default async function DashboardPage() {
  const queryClient = getQueryClient();

  await queryClient.prefetchQuery(
    getVehicleCountApiVehiclesCountGetOptions({ client: apiClient }),
  );

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <DashboardClient />
    </HydrationBoundary>
  );
}
