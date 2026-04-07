from fastapi import APIRouter
import psutil, subprocess, os

router = APIRouter(prefix="/server", tags=["server"])

@router.get("/status")
def server_status():
    ram = psutil.virtual_memory().percent
    cpu = psutil.cpu_percent(interval=0.5)
    
    battery = None
    try:
        result = subprocess.run(
            ["upower", "-i", "/org/freedesktop/UPower/devices/battery_BAT0"],
            capture_output=True, text=True, timeout=3
        )
        for line in result.stdout.splitlines():
            if "percentage" in line.lower():
                battery = int(line.strip().split()[-1].replace("%", ""))
                break
    except Exception:
        pass

    return {"ram": round(ram, 1), "cpu": round(cpu, 1), "battery": battery, "online": True}
