import os
import sqlite3
import pandas as pd
import re
import logging
from typing import Dict, List, Any, Optional

logger = logging.getLogger("DATABASE")

def clean_column_name(col: str) -> str:
    clean = re.sub(r'[^a-zA-Z0-9]', '_', str(col))
    return clean.strip('_')

def init_database(db_path: str, config: Dict[str, Dict[str, str]], force_reload: bool = False) -> None:
    if os.path.exists(db_path) and not force_reload:
        return

    conn = sqlite3.connect(db_path)
    for excel_file, sheet_map in config.items():
        if not os.path.exists(excel_file):
            continue

        xls = pd.ExcelFile(excel_file)
        for sheet_name, table_name in sheet_map.items():
            if sheet_name in xls.sheet_names:
                df = pd.read_excel(xls, sheet_name=sheet_name)
                df.columns = [clean_column_name(c) for c in df.columns]
                df.to_sql(table_name, conn, if_exists='replace', index=False)

    conn.close()

def get_schema_summary(db_path: str) -> str:
    if not os.path.exists(db_path):
        return ""

    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    cursor.execute("SELECT name FROM sqlite_master WHERE type='table';")
    tables = cursor.fetchall()

    schema_lines = []
    for table in tables:
        table_name = table[0]
        cursor.execute(f"PRAGMA table_info({table_name})")
        columns = [col[1] for col in cursor.fetchall()]
        cursor.execute(f"SELECT * FROM {table_name} LIMIT 3")
        sample_rows = cursor.fetchall()

        schema_lines.append(f"\nTable: {table_name}")
        schema_lines.append(f"Columns: {', '.join(columns)}")
        schema_lines.append(f"Sample Data: {sample_rows}")

    conn.close()
    return "\n".join(schema_lines)

def execute_query(db_path: str, query: str) -> Optional[List[Any]]:
    if not query.strip().upper().startswith("SELECT"):
        return None

    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    try:
        cursor.execute(query)
        results = cursor.fetchall()
        column_names = [description[0] for description in cursor.description]
        conn.close()
        return [column_names] + results
    except sqlite3.Error:
        conn.close()
        return None
