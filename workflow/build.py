"""Assemble csv-to-mysql.workflow.json from the node definitions below and the JS files next to this script.

Edit validate.js / report.js / SETTINGS here, then run:  python workflow/build.py
"""
import json
from pathlib import Path

HERE = Path(__file__).parent

# Everything a user changes per table lives in this one node.
SETTINGS = {
    "table": "customers",
    "columnMap": {
        "Customer ID": "external_id",
        "Full Name": "name",
        "Email": "email",
        "Signup Date": "signup_date",
        "Credit Limit": "credit_limit",
    },
    "required": ["external_id", "name", "email"],
    "types": {"external_id": "integer", "email": "email", "signup_date": "date", "credit_limit": "number"},
    "maxLength": {"name": 120, "email": 190},
    "dayFirst": True,
}


def node(name, type_, version, position, parameters, **extra):
    return {"parameters": parameters, "name": name, "type": type_, "typeVersion": version,
            "position": position, **extra}


nodes = [
    node("CSV Upload Form", "n8n-nodes-base.formTrigger", 2.2, [0, 0], {
        "formTitle": "CSV → MySQL import",
        "formDescription": "Upload a CSV. Valid rows go into MySQL; invalid rows are skipped and listed in the error log you get back.",
        "formFields": {"values": [{
            "fieldLabel": "csv", "fieldType": "file", "acceptFileTypes": ".csv",
            "multipleFiles": False, "requiredField": True,
        }]},
        "options": {"path": "csv-import"},
    }, webhookId="5d0c1a52-csv-import"),
    node("Extract CSV", "n8n-nodes-base.extractFromFile", 1, [220, 0], {
        "binaryPropertyName": "csv",
        "options": {"headerRow": True},
    }),
    node("Settings", "n8n-nodes-base.set", 3.4, [440, 0], {
        "mode": "raw",
        "jsonOutput": json.dumps(SETTINGS, indent=2),
        "options": {},
    }, executeOnce=True, notes="Edit this node to change the target table, CSV→column mapping, required fields and types."),
    node("Validate & Map", "n8n-nodes-base.code", 2, [660, 0], {
        "jsCode": (HERE / "validate.js").read_text(encoding="utf-8"),
    }),
    node("Valid row?", "n8n-nodes-base.if", 2.2, [880, 0], {
        "conditions": {
            "options": {"caseSensitive": True, "typeValidation": "strict", "version": 2},
            "conditions": [{
                "id": "c1", "leftValue": "={{ $json._valid }}", "rightValue": True,
                "operator": {"type": "boolean", "operation": "true", "singleValue": True},
            }],
            "combinator": "and",
        },
        "options": {},
    }),
    node("Drop helper fields", "n8n-nodes-base.code", 2, [1100, -100], {
        "jsCode": "return $input.all().map(i => {\n"
                  "  const { _line, _valid, _errors, ...row } = i.json;\n"
                  "  return { json: row };\n});",
    }),
    node("Insert into MySQL", "n8n-nodes-base.mySql", 2.4, [1320, -100], {
        "table": {"__rl": True, "mode": "name", "value": "={{ $('Settings').first().json.table }}"},
        "dataMode": "autoMapInputData",
        "options": {"queryBatching": "independently"},
    }, onError="continueRegularOutput", alwaysOutputData=True,
       credentials={"mySql": {"id": "mysqlLocal", "name": "MySQL account"}}),
    node("Merge", "n8n-nodes-base.merge", 3, [1540, 0], {}),
    node("Build Report", "n8n-nodes-base.code", 2, [1760, 0], {
        "jsCode": (HERE / "report.js").read_text(encoding="utf-8"),
    }, executeOnce=True),
    node("Show Result", "n8n-nodes-base.form", 2.5, [1980, 0], {
        "operation": "completion",
        "respondWith": "returnBinary",
        "completionTitle": "={{ $json.inserted }} of {{ $json.total_rows }} rows imported",
        "completionMessage": "={{ $json.skipped }} row(s) skipped. The error log (error_log.csv) is downloading now.",
        "inputDataFieldName": "data",
        "options": {},
    }),
]


def link(to, index=0):
    return {"node": to, "type": "main", "index": index}


connections = {
    "CSV Upload Form": {"main": [[link("Extract CSV")]]},
    "Extract CSV": {"main": [[link("Settings")]]},
    "Settings": {"main": [[link("Validate & Map")]]},
    "Validate & Map": {"main": [[link("Valid row?")]]},
    "Valid row?": {"main": [[link("Drop helper fields")], [link("Merge", 1)]]},
    "Drop helper fields": {"main": [[link("Insert into MySQL")]]},
    "Insert into MySQL": {"main": [[link("Merge", 0)]]},
    "Merge": {"main": [[link("Build Report")]]},
    "Build Report": {"main": [[link("Show Result")]]},
}

workflow = {
    "name": "CSV → MySQL import (reusable)",
    "nodes": nodes,
    "connections": connections,
    "settings": {"executionOrder": "v1"},
    "pinData": {},
    "active": False,
    "id": "csvToMysqlDemo01",
}

out = HERE / "csv-to-mysql.workflow.json"
out.write_text(json.dumps(workflow, indent=2, ensure_ascii=False), encoding="utf-8")
print(f"wrote {out}")
