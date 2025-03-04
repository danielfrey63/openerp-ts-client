import { config } from 'dotenv';
import inquirer from 'inquirer';
import { OpenERPClient, OpenERPConfig, LoginCredentials, SaleOrder, OrderLine } from './client';

config();

const BASE_URL = process.env.OPENERP_BASE_URL || 'https://erp.frey-champagne-import.ch';

async function main() {
  try {
    const config: OpenERPConfig = {
      baseUrl: BASE_URL
    };

    const client = new OpenERPClient(config);

    // Initialize databases variable
    let databases: string[] = [];

    // List available databases with better error handling
    try {
      databases = await client.listDatabases();
      console.log('\nAvailable databases:');
    } catch (dbError) {
      console.error('Failed to fetch databases:');
      console.error('Error details:', dbError);
      console.error('Base URL:', BASE_URL);
      process.exit(1);
    }

    const dbChoice = await inquirer.prompt([
      {
        type: 'list',
        name: 'database',
        message: 'Select a database:',
        choices: databases
      }
    ]);

    // Get login credentials
    const credentials = await inquirer.prompt([
      {
        type: 'input',
        name: 'username',
        message: 'Enter username:'
      },
      {
        type: 'password',
        name: 'password',
        message: 'Enter password:'
      }
    ]);

    const loginCredentials: LoginCredentials = {
      db: dbChoice.database,
      username: credentials.username,
      password: credentials.password
    };

    // Perform login
    const session = await client.login(loginCredentials);
    console.log('\nLogin successful!');
    console.log(`Welcome ${session.username}!\n`);

    while (true) {
      const action = await inquirer.prompt([
        {
          type: 'list',
          name: 'choice',
          message: 'What would you like to do?',
          choices: [
            { name: 'List open sale orders', value: 'list_orders' },
            { name: 'Exit', value: 'exit' }
          ]
        }
      ]);

      if (action.choice === 'exit') {
        break;
      }

      if (action.choice === 'list_orders') {
        while (true) { // New loop for SO list level
          const orders = await client.getOpenSaleOrders();
          
          if (orders.length === 0) {
            console.log('No open sale orders found.');
            break;
          }

          const orderChoice = await inquirer.prompt([
            {
              type: 'list',
              name: 'order',
              message: 'Select an order to view details:',
              choices: [
                ...orders.map(order => ({
                  name: `${order.name} - ${order.partner_id[1]}`,
                  value: order.id
                })),
                { name: 'Back', value: 'back' }
              ]
            }
          ]);

          if (orderChoice.order === 'back') {
            break;
          }

          const orderLines = await client.getSaleOrderLines(orderChoice.order);
          
          // Find the maximum length of each column for alignment
          const maxQtyLength = Math.max(...orderLines.map(line => `${line.product_uom_qty}x`.length));
          
          // Extract default_code and name_template from product_id[1]
          const productDetails = orderLines.map(line => {
            const productIdStr = line.product_id[1];
            const match = productIdStr.match(/\[(.*?)\] (.*)/);
            return {
              code: match ? match[1] : '',
              name: match ? match[2] : productIdStr
            };
          });
          
          const maxCodeLength = Math.max(...productDetails.map(p => p.code.length));
          const maxNameLength = Math.max(...productDetails.map(p => p.name.length));
          
          const lineChoice = await inquirer.prompt([
            {
              type: 'list',
              name: 'line',
              message: 'Select a line to modify product:',
              choices: [
                ...orderLines.map((line, index) => {
                  const qtyStr = `${line.product_uom_qty}x`.padEnd(maxQtyLength + 2);
                  
                  // Extract default_code and name_template
                  const productIdStr = line.product_id[1];
                  const match = productIdStr.match(/\[(.*?)\] (.*)/);
                  const code = match ? match[1] : '';
                  const name = match ? match[2] : productIdStr;
                  
                  const codeStr = `[${code}]`.padEnd(maxCodeLength + 4);
                  const nameStr = name.padEnd(maxNameLength + 2);
                  const priceStr = `CHF ${line.price_unit.toFixed(2)}`;
                  
                  return {
                    name: `${qtyStr} ${codeStr} ${nameStr} ${priceStr}`,
                    value: index
                  };
                }),
                { name: 'Back', value: 'back' }
              ]
            }
          ]);

          if (lineChoice.line === 'back') {
            continue; // Goes back to SO list
          }

          // Store the selected order line for easier reference
          const selectedLine = orderLines[lineChoice.line];

          const productChoice = await inquirer.prompt([
            {
              type: 'input',
              name: 'newProductCode',
              message: 'Enter new product code (or leave empty to go back):',
            }
          ]);

          if (!productChoice.newProductCode) {
            continue; // Goes back to SO list
          }

          try {
            // Get details of the new product before updating
            const newProductDetails = await client.getProductDetailsByCode(productChoice.newProductCode);
            
            if (!newProductDetails) {
              console.log(`Product with code ${productChoice.newProductCode} not found.`);
              continue;
            }
            
            // Display the product that will be used for the update in green color
            console.log(`  New product details: \x1b[32m[${newProductDetails.code}] ${newProductDetails.name} - CHF ${newProductDetails.price.toFixed(2)}\x1b[0m`);
            
            const confirmUpdate = await inquirer.prompt([
              {
                type: 'confirm',
                name: 'proceed',
                message: 'Do you want to proceed with the update?',
                default: true
              }
            ]);
            
            if (!confirmUpdate.proceed) {
              console.log('Update cancelled.');
              continue;
            }
            
            // Proceed with the update
            await client.updateOrderLineProduct(orderChoice.order, selectedLine.id, productChoice.newProductCode);
            console.log(`Successfully updated order line with new product: ${newProductDetails.name}`);
          } catch (error) {
            console.error('Error updating order line:', error instanceof Error ? error.message : error);
          }
        }
      }
    }

    console.log('Goodbye!');

  } catch (error) {
    console.error('Error:', error instanceof Error ? error.message : 'Unknown error');
    process.exit(1);
  }
}

main().catch(error => {
  console.error('Fatal error:');
  if (error.response) {
    console.error('Status:', error.response.status);
    console.error('Headers:', error.response.headers);
    console.error('Data:', error.response.data);
  }
  console.error('Full error:', error);
  process.exit(1);
});