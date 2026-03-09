"""
Fleet Optimization System - Configuration Module
Contains all system parameters and constants
"""
import os
from datetime import datetime

# ============================================================================
# COST MODEL PARAMETERS
# ============================================================================

# Leasing Model (DO NOT MODIFY)
PENALTY_RATE = 0.92  # Penalty for leasing overage (PLN/km)
OPERATIONAL_COST_PER_KM = 0  # Operational cost (PLN/km)

# Realistic Cost Model
EMPTY_FIXED_COST = 1000  # Fixed cost for empty relocation (PLN)
EMPTY_KM_COST = 1.0  # Empty relocation cost per km (PLN/km)
EMPTY_HOUR_COST = 150  # Empty relocation cost per hour (PLN/h)

# Service Parameters
SERVICE_HOURS = 48  # Service time (hours)
SERVICE_HOURLY_COST = 200  # Service cost per hour (PLN/h)
SERVICE_COST = SERVICE_HOURS * SERVICE_HOURLY_COST  # Total: 9600 PLN

# ============================================================================
# SIMULATION PARAMETERS
# ============================================================================

# Date Range Configuration
START_DATE = '2024-01-01'
END_DATE = '2024-04-01'

# For full year: START_DATE = '2024-01-01', END_DATE = '2025-01-01'
# For two years: START_DATE = '2024-01-01', END_DATE = '2026-01-01'

SIM_START_DATE = datetime.strptime(START_DATE, '%Y-%m-%d')

# ============================================================================
# FILE PATHS
# ============================================================================

# Get the project root directory (two levels up from fleet_opt)
import os
project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), '../..'))

# Input files
INPUT_FILES = {
    'vehicles': os.path.join(project_root, '__CSV_DATA/vehicles.csv'),
    'locations': os.path.join(project_root, '__CSV_DATA/locations.csv'),
    'routes': os.path.join(project_root, '__CSV_DATA/routes.csv'),
    'segments': os.path.join(project_root, '__CSV_DATA/segments.csv'),
    'relations': os.path.join(project_root, '__CSV_DATA/locations_relations.csv')
}

# Output directory
OUTPUT_DIR = 'output_merged'
os.makedirs(OUTPUT_DIR, exist_ok=True)

# Output files
OUTPUT_FILES = {
    'solution': os.path.join(OUTPUT_DIR, 'merged_solution.csv'),
    'vehicle_stats': os.path.join(OUTPUT_DIR, 'merged_vehicle_stats.csv'),
    'summary': os.path.join(OUTPUT_DIR, 'merged_summary.csv')
}