import csv
import json
import re
import os

def extract_dose(name):
    """
    Versucht eine Mengenangabe (z.B. 10 mg, 5 mg/ml, 50 µg) 
    aus dem Namen des Medikidents zu extrahieren.
    """
    # Sucht nach Mustern wie '10 mg', '5 mg/ml', '50 µg/h', '2,5 %'
    match = re.search(r'\b\d+(?:[,\.]\d+)?\s*(?:mg|µg|mcg|g|ml|%)(?:/\d+\s*ml|/h)?\b', name, re.IGNORECASE)
    return match.group(0) if match else ""

def convert_txt_to_json(txt_file_path, json_output_path):
    entries = []

    with open(txt_file_path, mode='r', encoding='utf-8-sig') as f:
        # Erste Zeile (Metadaten/Header-Titel) überspringen
        next(f)
        
        # CSV-Reader mit Semikolon als Trennzeichen initialisieren
        reader = csv.DictReader(f, delimiter=';')
        
        for row in reader:
            # Zeilen ohne PZN (z.B. Leerzeilen am Ende) überspringen
            if not row.get('PZN'):
                continue
                
            name = (row.get('Bezeichnung') or '').strip()
            
            # Eintrag nach dem gewünschten JSON-Format aufbauen
            json_entry = {
                "pzn": (row.get('PZN') or '').strip(),
                "name": name,
                "wirkstoff": "",     # Nicht in der TXT enthalten
                "atc": "",           # Nicht in der TXT enthalten
                "dose": extract_dose(name), # Extrahiert falls im Namen vorhanden
                "form": (row.get('Darreichungsform') or '').strip(),
                "hersteller": "",    # Nicht in der TXT enthalten
                "packungsgröße": (row.get('Packungseinheit') or '').strip()
            }
            entries.append(json_entry)

    # In die JSON-Datei schreiben (schön formatiert mit Einrückung)
    with open(json_output_path, mode='w', encoding='utf-8') as f:
        json.dump(entries, f, indent=2, ensure_ascii=False)

    print(f"Erfolgreich {len(entries)} Einträge konvertiert und in '{json_output_path}' gespeichert.")

# Skript ausführen
if __name__ == "__main__":
    # Bestimmt den Ordner, in dem dieses Skript (convert.py) liegt
    script_dir = os.path.dirname(os.path.abspath(__file__))
    
    txt_datei = os.path.join(script_dir, "bfarm.dePZNPZN.txt")
    json_ausgabe = os.path.join(script_dir, "bfarm_db_neu.json")
    
    convert_txt_to_json(txt_datei, json_ausgabe)