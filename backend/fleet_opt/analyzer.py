import pandas as pd
from .config import OUTPUT_FILES


class ResultsAnalyzer:
    
    def __init__(self, assignments, vehicle_states, route_info_map):
        self.assignments = assignments
        self.vehicle_states = vehicle_states
        self.route_info_map = route_info_map
        
        self.solution_df = None
        self.vehicle_stats_df = None
        self.summary_df = None

    def analyze(self):
        print("\n" + "="*70)
        print("ANALYZING RESULTS ")
        print("="*70)
        
        self._create_solution_dataframe()
        self._create_vehicle_statistics()
        self._create_summary()
        self._print_results()

    def _create_solution_dataframe(self):
        self.solution_df = pd.DataFrame(self.assignments)

    def _create_vehicle_statistics(self):
        vehicle_stats = []
        
        for vs in self.vehicle_states:
            if not vs.assigned_routes:
                continue
            vehicle_stats.append(vs.to_dict())
        
        self.vehicle_stats_df = pd.DataFrame(vehicle_stats)

    def _create_summary(self):
        if self.vehicle_stats_df.empty:
            total_relocation = 0
            total_service = 0
            total_penalties = 0
            total_cost = 0
            vehicles_used = 0
            total_services = 0
        else:
            total_relocation = self.vehicle_stats_df['relocation_cost_pln'].sum()
            total_service = self.vehicle_stats_df['service_cost_pln'].sum()
            total_penalties = self.vehicle_stats_df['penalty_cost_pln'].sum()
            total_cost = total_relocation + total_service + total_penalties
            vehicles_used = (self.vehicle_stats_df['assigned_routes_count'] > 0).sum()
            total_services = self.vehicle_stats_df['services_taken'].sum()
        
        self.summary_df = pd.DataFrame({
            'Metric': [
                'Algorithm',
                'Total Cost (PLN)',
                'Relocation Cost (PLN)',
                'Service Cost (PLN)',
                'Penalty Cost (PLN)',
                'Routes Assigned',
                'Vehicles Used',
                'Total Services'
            ],
            'Value': [
                'Merged Realistic (Time-Based)',
                f"{total_cost:,.2f}",
                f"{total_relocation:,.2f}",
                f"{total_service:,.2f}",
                f"{total_penalties:,.2f}",
                len(self.solution_df),
                vehicles_used,
                total_services
            ]
        })

    def _print_results(self):
        if self.vehicle_stats_df.empty:
            print("\n⚠️ No routes were assigned.")
            return
        
        total_relocation = self.vehicle_stats_df['relocation_cost_pln'].sum()
        total_service = self.vehicle_stats_df['service_cost_pln'].sum()
        total_penalties = self.vehicle_stats_df['penalty_cost_pln'].sum()
        total_cost = total_relocation + total_service + total_penalties
        total_km = self.vehicle_stats_df['total_distance_km'].sum()
        
        print(f"\n💰 COSTS (REALISTIC MODEL):")
        print(f"  Relocations (1000 + 1/km + 150/h): {total_relocation:>15,.2f} PLN")
        print(f"  Services (9600/each):              {total_service:>15,.2f} PLN")
        print(f"  Penalties (Leasing 0.92/km):       {total_penalties:>15,.2f} PLN")
        print(f"  {'─'*50}")
        print(f"  TOTAL (REALISTIC COST):            {total_cost:>15,.2f} PLN")

        print(f"\n📊 STATISTICS:")
        print(f"  Routes assigned: {len(self.solution_df)}")
        print(f"  Vehicles used: {(self.vehicle_stats_df['assigned_routes_count'] > 0).sum()}")
        print(f"  Total distance (with relocations): {total_km:,.0f} km")
        print(f"  Total services: {self.vehicle_stats_df['services_taken'].sum()}")

    def save_results(self):
        print("\n💾 Saving results...")
        
        if self.solution_df is not None:
            self.solution_df.to_csv(OUTPUT_FILES['solution'], index=False)
            print(f"  ✓ Solution: {OUTPUT_FILES['solution']}")
        
        if self.vehicle_stats_df is not None:
            self.vehicle_stats_df.to_csv(OUTPUT_FILES['vehicle_stats'], index=False)
            print(f"  ✓ Vehicle stats: {OUTPUT_FILES['vehicle_stats']}")
        
        if self.summary_df is not None:
            self.summary_df.to_csv(OUTPUT_FILES['summary'], index=False)
            print(f"  ✓ Summary: {OUTPUT_FILES['summary']}")
        
        print(f"✓ All results saved to '{OUTPUT_FILES['solution'].rsplit('/', 1)[0]}/'")

    def get_summary_stats(self):
        if self.vehicle_stats_df.empty:
            return {
                'total_cost': 0,
                'routes_assigned': 0,
                'vehicles_used': 0
            }
        
        return {
            'total_cost': (self.vehicle_stats_df['relocation_cost_pln'].sum() +
                          self.vehicle_stats_df['service_cost_pln'].sum() +
                          self.vehicle_stats_df['penalty_cost_pln'].sum()),
            'routes_assigned': len(self.solution_df),
            'vehicles_used': (self.vehicle_stats_df['assigned_routes_count'] > 0).sum(),
            'total_services': self.vehicle_stats_df['services_taken'].sum(),
            'total_distance_km': self.vehicle_stats_df['total_distance_km'].sum()
        }


def analyze_and_save_results(assignments, vehicle_states, route_info_map):
    analyzer = ResultsAnalyzer(assignments, vehicle_states, route_info_map)
    analyzer.analyze()
    analyzer.save_results()
    return analyzer