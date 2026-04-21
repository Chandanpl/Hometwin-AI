FAN_WATTS = 75
LIGHT_WATTS = 18
BASELINE_WATTS = 140


def calculate_energy(fan, light, occupancy, eco_mode=True):
    usage = 0
    if fan == "ON":
        usage += FAN_WATTS
    if light == "ON":
        usage += LIGHT_WATTS

    waste = usage if occupancy == 0 else 0
    eco_bonus = 12 if eco_mode and waste == 0 else 0
    saved = max(BASELINE_WATTS - usage - waste, 0)
    score = max(0, min(100, round((saved / BASELINE_WATTS) * 100 + eco_bonus)))

    return {
        "energy_usage": usage,
        "energy_waste": waste,
        "energy_saved": saved,
        "energy_score": score,
    }
