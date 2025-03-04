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

## API Reference

### Methods

| Method | Description | Parameters | Return Type |
|--------|-------------|------------|-------------|
| `constructor` | Creates a new OpenERP client instance | `config: OpenERPConfig` - Configuration object with baseUrl property | `OpenERPClient` |
| `listDatabases` | Lists all available databases on the OpenERP server | None | `Promise<string[]>` |
| `login` | Authenticates with the OpenERP server | `credentials: LoginCredentials` - Object containing db, username, and password | `Promise<Session>` |
| `getOpenSaleOrders` | Retrieves all open sales orders (draft, sent, or in progress) | None | `Promise<SaleOrder[]>` |
| `getSaleOrderLines` | Retrieves all order lines for a specific sales order | `orderId: number` - ID of the sales order | `Promise<OrderLine[]>` |
| `updateOrderLineProduct` | Updates a product in a sales order line | `orderId: number` - ID of the sales order<br>`oldProductId: number` - ID of the product to replace<br>`newProductCode: string` - Code of the new product | `Promise<void>` |

### Data Types

#### OpenERPConfig
```typescript
interface OpenERPConfig {
  baseUrl: string;
}
```

#### LoginCredentials
```typescript
interface LoginCredentials {
  db: string;
  username: string;
  password: string;
}
```

#### Session
```typescript
interface Session {
  id: string;
  db: string;
  uid: number;
  username: string;
}
```

#### SaleOrder
```typescript
interface SaleOrder {
  id: number;
  name: string;
  partner_id: [number, string];
  state: string;
}
```

#### OrderLine
```typescript
interface OrderLine {
  product_id: [number, string];
  product_uom_qty: number;
}
```

## Development

1. Clone the repository
2. Install dependencies: `npm install`
3. Build the package: `npm run build`
4. Run tests: `npm test`

## License

MIT
