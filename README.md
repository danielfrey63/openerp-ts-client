# OpenERP TypeScript Client

A TypeScript client for interacting with OpenERP's RPC API. This package provides a strongly-typed interface for making RPC calls to OpenERP servers.

## Installation

```bash
npm install @danielfrey63/openerp-ts-client
```

## Usage

```typescript
import { OpenERPClient } from '@danielfrey63/openerp-ts-client';

const client = new OpenERPClient({
    baseURL: 'http://your-openerp-server',
    db: 'your-database',
    username: 'admin',
    password: 'admin'
});

// Example: Search for partners
const partners = await client.search('res.partner', [['is_company', '=', true]]);
```

## Development

1. Clone the repository
2. Install dependencies: `npm install`
3. Build the package: `npm run build`
4. Run tests: `npm test`

## License

MIT