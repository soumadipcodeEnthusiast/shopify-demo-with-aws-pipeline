#!/usr/bin/env bash
# Seeds the ProductsTable after `sam deploy`. Run with the table name from
# the stack outputs: ./seed-products.sh <ProductsTableName> [region]
set -euo pipefail

TABLE="${1:?Usage: ./seed-products.sh <ProductsTableName> [region]}"
REGION="${2:-us-east-1}"

PRODUCTS='[
  {"id":"p1","name":"Classic Tee","price":19.99,"stock":25},
  {"id":"p2","name":"Canvas Tote Bag","price":24.0,"stock":12},
  {"id":"p3","name":"Ceramic Mug","price":14.5,"stock":40},
  {"id":"p4","name":"Wool Beanie","price":22.0,"stock":8},
  {"id":"p5","name":"Enamel Pin Set","price":9.99,"stock":60},
  {"id":"p6","name":"Limited Hoodie (sold out demo)","price":54.0,"stock":0}
]'

echo "$PRODUCTS" | python3 -c "
import json, subprocess, sys
products = json.load(sys.stdin)
for p in products:
    item = {
        'id': {'S': p['id']},
        'name': {'S': p['name']},
        'price': {'N': str(p['price'])},
        'stock': {'N': str(p['stock'])},
    }
    subprocess.run([
        'aws', 'dynamodb', 'put-item',
        '--table-name', '$TABLE',
        '--region', '$REGION',
        '--item', json.dumps(item),
    ], check=True)
    print(f\"seeded {p['id']}\")
"
