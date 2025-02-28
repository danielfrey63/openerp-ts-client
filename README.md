# OpenERP TypeScript Client

A TypeScript client for interacting with OpenERP's RPC API. This package provides a strongly-typed interface for making RPC calls to OpenERP servers.

## Installation

This package is available on both the public npm registry and GitHub Packages.

### Option 1: Install from public npm registry (Recommended)

This is the simplest option and works in all environments, including CI/CD pipelines like Vercel:

```bash
npm install @danielfrey63/openerp-ts-client
```

### Option 2: Install from GitHub Packages

If you prefer to use GitHub Packages, you need to configure npm to use GitHub Packages for the `@danielfrey63` scope:

1. Create or edit a `.npmrc` file in your project root:

```bash
@danielfrey63:registry=https://npm.pkg.github.com
```

2. Then install the package:

```bash
npm install @danielfrey63/openerp-ts-client
```

### Option 3: Using personal access token (for private repositories)

If you're working with private repositories or experiencing authentication issues with GitHub Packages:

1. Create a GitHub personal access token with `read:packages` scope
2. Configure npm with your token:

```bash
npm login --registry=https://npm.pkg.github.com --scope=@danielfrey63
# Or add to .npmrc:
# @danielfrey63:registry=https://npm.pkg.github.com
# //npm.pkg.github.com/:_authToken=YOUR_GITHUB_TOKEN
```

3. Then install the package:

```bash
npm install @danielfrey63/openerp-ts-client
```

### Option 4: Install directly from tarball

If you're having issues with the registries, you can install directly from the tarball:

```bash
# Install from a local tarball
npm install /path/to/danielfrey63-openerp-ts-client-1.0.8.tgz

# Or install from a URL
npm install https://github.com/danielfrey63/openerp-ts-client/releases/download/v1.0.8/danielfrey63-openerp-ts-client-1.0.8.tgz
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

## Vercel Deployment

If you're deploying to Vercel and experiencing authentication issues with GitHub Packages, you have two options:

### Option 1: Add GitHub Authentication to Vercel

1. Create a GitHub personal access token with `read:packages` scope
2. Add the token as an environment variable in your Vercel project settings:
   - Name: `GITHUB_TOKEN`
   - Value: Your GitHub token
3. Create a `.npmrc` file in your project root:

```
@danielfrey63:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=${GITHUB_TOKEN}
```

4. You can also add the environment variable to your `vercel.json` file:

```json
{
  "env": {
    "GITHUB_TOKEN": "@github-token"
  },
  "build": {
    "env": {
      "GITHUB_TOKEN": "@github-token"
    }
  }
}
```

Note: `@github-token` refers to a secret you've configured in the Vercel dashboard.

### Option 2: Use GitHub Releases

1. Download the package tarball from GitHub Releases
2. Add it to your project as a local dependency
3. Or create a `.npmrc` file that references the GitHub release directly:

```
# Use the public npm registry for most packages
registry=https://registry.npmjs.org/

# Use a direct GitHub download URL for your package
@danielfrey63:openerp-ts-client=https://github.com/danielfrey63/openerp-ts-client/releases/download/v1.0.8/danielfrey63-openerp-ts-client-1.0.8.tgz
```

## Development

1. Clone the repository
2. Install dependencies: `npm install`
3. Build the package: `npm run build`
4. Run tests: `npm test`

## License

MIT