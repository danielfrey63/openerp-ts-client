# OpenERP TypeScript Client

A TypeScript client for interacting with OpenERP's RPC API. This package provides a strongly-typed interface for making RPC calls to OpenERP servers.

## Installation

This package is published to GitHub Packages. To install it, you need to configure npm to use GitHub Packages for the `@danielfrey63` scope:

### Option 1: Configure npm for this package only

Create or edit a `.npmrc` file in your project root:

```bash
@danielfrey63:registry=https://npm.pkg.github.com
```

Then install the package:

```bash
npm install @danielfrey63/openerp-ts-client
```

### Option 2: Using personal access token (for private repositories)

If you're working with private repositories or experiencing authentication issues:

1. Create a GitHub personal access token with `read:packages` scope
2. Configure npm with your token:

```bash
npm login --registry=https://npm.pkg.github.com --scope=@danielfrey63
# Or add to .npmrc:
# @danielfrey63:registry=https://npm.pkg.github.com
# //npm.pkg.github.com/:_authToken=YOUR_GITHUB_TOKEN
```

Then install the package:

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