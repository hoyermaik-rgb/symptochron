import json
import time
import requests
import re
from bs4 import BeautifulSoup

# =====================================================================
# OFFLINE-ANREICHERUNG (HEURISTIK)
# Da es in Deutschland keine kostenlose öffentliche PZN-API gibt,
# versucht dieser Teil, Wirkstoff und Hersteller direkt aus dem Namen
# des Medikaments herauszufiltern. Das spart tausende Web-Anfragen!
# =====================================================================

WIRKSTOFFE = {
    "diazepam": "Diazepam",
    "midazolam": "Midazolam",
    "hydromorphon": "Hydromorphon",
    "tilidin": "Tilidin",
    "morphin": "Morphin",
    "oxycodon": "Oxycodon",
    "fentanyl": "Fentanyl",
    "fentanil": "Fentanyl",
    "methylphenidat": "Methylphenidat",
    "methadon": "Methadon",
    "levomethadon": "Levomethadon",
    "lorazepam": "Lorazepam",
    "phenobarbital": "Phenobarbital",
    "phenobarbitone": "Phenobarbital",
    "bromazepam": "Bromazepam",
    "alprazolam": "Alprazolam",
    "zolpidem": "Zolpidem",
    "buprenorphin": "Buprenorphin",
    "piritramid": "Piritramid",
    "sufentanil": "Sufentanil",
    "lormetazepam": "Lormetazepam",
    "flunitrazepam": "Flunitrazepam",
    "temazepam": "Temazepam",
    "chlordiazepoxid": "Chlordiazepoxid",
    "chlordiazepoxide": "Chlordiazepoxid",
    "clonazepam": "Clonazepam",
    "clobazam": "Clobazam",
    "modafinil": "Modafinil",
    "cannabis": "Cannabis",
    "dronabinol": "Dronabinol",
    "tetrahydrocannabinol": "Tetrahydrocannabinol",
    "thc": "Tetrahydrocannabinol",
    "oxazepam": "Oxazepam",
    "rotigotin": "Rotigotin",
    "pramipexol": "Pramipexol",
    "gabapentin": "Gabapentin",
    "pregabalin": "Pregabalin",
    "levodopa": "Levodopa",
    "benserazid": "Benserazid",
    "codein": "Codein",
    "dihydrocodein": "Dihydrocodein",
    "pethidin": "Pethidin",
    "remifentanil": "Remifentanil",
    "alfentanil": "Alfentanil",
}

BRAND_TO_WIRKSTOFF = {
    "adumbran": "Oxazepam",
    "lexotan": "Bromazepam",
    "subutex": "Buprenorphin",
    "tavor": "Lorazepam",
    "valium": "Diazepam",
    "ritalin": "Methylphenidat",
    "concerta": "Methylphenidat",
    "medikinet": "Methylphenidat",
    "dormicum": "Midazolam",
    "sifrol": "Pramipexol",
    "neupro": "Rotigotin",
    "restex": "Levodopa / Benserazid",
    "lyrica": "Pregabalin",
    "oxygesic": "Oxycodon",
    "targin": "Oxycodon / Naloxon",
    "valoron": "Tilidin / Naloxon",
    "l-polamidon": "Levomethadon",
    "polamidon": "Levomethadon",
    "substitol": "Morphin",
    "mst-continus": "Morphin",
    "mst continus": "Morphin",
    "m-stada": "Morphin",
    "m-dolor": "Morphin",
    "m-beta": "Morphin",
    "morphelan": "Morphin",
    "seconal": "Secobarbital",
    "noctamid": "Lormetazepam",
    "rohypnol": "Flunitrazepam",
    "frisium": "Clobazam",
    "vigil": "Modafinil",
    "gabax": "Gabapentin",
}

HERSTELLER_LIST = [
    "Ratiopharm", "Hexal", "1A Pharma", "AL", "AbZ", "Stada", "Neuraxpharm", 
    "Gudjons", "Desitin", "Roche", "Hameln", "Fresenius", "Heumann", "Bexal", 
    "Beta", "Biochemie", "Sandoz", "Winthrop", "Zentiva", "Mundipharma", 
    "G.L. Pharma", "Aristo", "Aliud", "Takeda", "Pfizer", "Novartis", "Sanofi", 
    "Boehringer", "Medice", "Torrex", "Panpharma", "Lomapharm", "UCB", 
    "GlaxoSmithKline", "GSK", "Upjohn"
]

def extract_details_offline(name):
    name_lower = name.lower()
    
    # 1. Hersteller ermitteln
    hersteller = ""
    for h in HERSTELLER_LIST:
        if re.search(r'\b' + re.escape(h.lower()) + r'\b', name_lower):
            hersteller = h
            break
    if not hersteller:
        if " ratiopharm" in name_lower or " ratio" in name_lower:
            hersteller = "Ratiopharm"
        elif " 1a" in name_lower:
            hersteller = "1A Pharma"
        elif " al " in name_lower or name_lower.endswith(" al"):
            hersteller = "ALIUD PHARMA"
        elif " abz" in name_lower:
            hersteller = "AbZ Pharma"
        elif " gcf" in name_lower or " cf " in name_lower:
            hersteller = "Centrafarm"
        elif " pch " in name_lower or name_lower.endswith(" pch"):
            hersteller = "Pharmachemie"

    # 2. Wirkstoff ermitteln
    wirkstoff = ""
    for brand, ws in BRAND_TO_WIRKSTOFF.items():
        if re.search(r'\b' + re.escape(brand) + r'\b', name_lower):
            wirkstoff = ws
            break
            
    if not wirkstoff:
        for ws_key, ws_val in WIRKSTOFFE.items():
            if re.search(r'\b' + re.escape(ws_key) + r'\b', name_lower):
                wirkstoff = ws_val
                break
                
    return wirkstoff, hersteller

# =====================================================================
# ONLINE-ANREICHERUNG (WEB-SCRAPER)
# =====================================================================

def fetch_missing_data_from_web(pzn):
    """
    Beispiel-Funktion: Ruft eine Informationsseite anhand der PZN auf
    und extrahiert Hersteller, Wirkstoff und ATC.
    """
    # Dummy-URL (muss an das gewünschte Zielportal angepasst werden)
    url = f"https://freie-arzneimittel-datenbank.de/pzn/{pzn}"
    
    # Dummy-Domain überspringen, da sie im echten Internet nicht existiert
    if "freie-arzneimittel-datenbank.de" in url:
        return None
        
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) PZN-Enricher/1.0"
    }
    
    try:
        response = requests.get(url, headers=headers, timeout=5)
        if response.status_code == 200:
            soup = BeautifulSoup(response.text, 'html.parser')
            
            wirkstoff = soup.find(id="wirkstoff-feld").text.strip() if soup.find(id="wirkstoff-feld") else ""
            atc = soup.find(id="atc-feld").text.strip() if soup.find(id="atc-feld") else ""
            hersteller = soup.find(id="hersteller-feld").text.strip() if soup.find(id="hersteller-feld") else ""
            
            return {
                "wirkstoff": wirkstoff,
                "atc": atc,
                "hersteller": hersteller
            }
    except Exception as e:
        print(f"Fehler bei Web-Abfrage für PZN {pzn}: {e}")
        
    return None

def enrich_json(input_json_path, output_json_path):
    # 1. Bestehende (unvollständige) JSON laden
    with open(input_json_path, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    print(f"Starte Anreicherung für {len(data)} Einträge...")
    
    web_queries = 0
    offline_matches = 0
    
    for index, entry in enumerate(data):
        # Schritt A: Versuche Details offline über Heuristik zu ermitteln
        name = entry.get("name", "")
        ws_off, hs_off = extract_details_offline(name)
        
        if ws_off and not entry.get("wirkstoff"):
            entry["wirkstoff"] = ws_off
            offline_matches += 1
        if hs_off and not entry.get("hersteller"):
            entry["hersteller"] = hs_off
            
        # Schritt B: Nur wenn immer noch wichtige Daten fehlen, versuchen wir das Web
        if not entry.get("wirkstoff") or not entry.get("hersteller"):
            pzn = entry["pzn"]
            
            # Details abrufen (überspringt Dummy-Domain automatisch)
            fetched_data = fetch_missing_data_from_web(pzn)
            
            if fetched_data:
                if fetched_data.get("wirkstoff"): entry["wirkstoff"] = fetched_data["wirkstoff"]
                if fetched_data.get("atc"): entry["atc"] = fetched_data["atc"]
                if fetched_data.get("hersteller"): entry["hersteller"] = fetched_data["hersteller"]
                web_queries += 1
                time.sleep(1) # Rate Limiting
            
        # Zwischenspeichern alle 5000 Einträge
        if index % 5000 == 0:
            with open(output_json_path, 'w', encoding='utf-8') as f:
                json.dump(data, f, indent=2, ensure_ascii=False)

    # 2. Finales Speichern
    with open(output_json_path, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
        
    print(f"Anreicherung erfolgreich abgeschlossen!")
    print(f"-> {offline_matches} Einträge konnten offline angereichert werden.")
    print(f"-> {web_queries} Einträge wurden online angefragt.")

# Ausführen
if __name__ == "__main__":
    import os
    script_dir = os.path.dirname(os.path.abspath(__file__))
    
    input_datei = os.path.join(script_dir, "bfarm_db_neu.json")
    output_datei = os.path.join(script_dir, "bfarm_db_angereichert.json")
    
    enrich_json(input_datei, output_datei)