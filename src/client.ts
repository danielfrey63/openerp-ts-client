import axios, { AxiosInstance } from 'axios';
import { parseStringPromise } from 'xml2js';

export interface OpenERPConfig {
  baseUrl: string;
}

export interface LoginCredentials {
  db: string;
  username: string;
  password: string;
}

export interface Session {
  id: string;
  db: string;
  uid: number;
  username: string;
}

export interface SaleOrder {
  id: number;
  name: string;
  partner_id: [number, string];
  state: string;
}

export interface OrderLine {
  id: number;
  product_id: [number, string];
  product_uom_qty: number;
  name: string;
  price_unit: number;
}

export interface ProductDetails {
  id: number;
  code: string;
  name: string;
  name_template: string;
  price: number;
}

export class OpenERPClient {
  private xmlRpcClient: AxiosInstance;
  public session: Session | null = null;

  constructor(config: OpenERPConfig) {
    const baseUrl = config.baseUrl.replace(/\/+$/, '');
    
    this.xmlRpcClient = axios.create({
      baseURL: baseUrl,
      headers: {
        'Content-Type': 'text/xml',
        'Accept': 'text/xml'
      },
      validateStatus: () => true
    });
  }

  private getEndpoint(service: 'db'|'common'|'object'): string {
    return `/xmlrpc/${service}`;
}

  private createXmlRpcRequest(method: string, params: any[] = []): string {
    const paramXml = params.map(param => 
      `<param>${this.serializeParam(param)}</param>`
    ).join('');

    return `<?xml version="1.0"?>
<methodCall>
    <methodName>${method}</methodName>
    <params>${paramXml}</params>
</methodCall>`;
  }

  private serializeParam(param: any): string {
    if (typeof param === 'string') {
      return `<value><string>${param}</string></value>`;
    } else if (typeof param === 'number') {
      return `<value><int>${param}</int></value>`;
    } else if (Array.isArray(param)) {
      const items = param.map(item => this.serializeParam(item)).join('');
      return `<value><array><data>${items}</data></array></value>`;
    } else if (typeof param === 'object' && param !== null) {
      const members = Object.entries(param).map(([key, value]) => 
        `<member><name>${key}</name>${this.serializeParam(value)}</member>`
      ).join('');
      return `<value><struct>${members}</struct></value>`;
    }
    return `<value><string>${String(param)}</string></value>`;
  }

  async updateOrderLineProduct(orderId: number, orderLineId: number, newProductCode: string): Promise<void> {
    if (!this.session) {
      throw new Error('Not authenticated');
    }
    
    // First, search for the product with the given code
    const productIds = await this.xmlRpc('object', 'execute', [
      this.session.db,
      this.session.uid,
      this.session.id,
      'product.product',
      'search',
      [['default_code', '=', newProductCode]]
    ]);
  
    // More robust checking of the response structure
    if (!productIds || !productIds.array || !productIds.array[0] || 
        !productIds.array[0].data || !productIds.array[0].data[0] || 
        !productIds.array[0].data[0].value || productIds.array[0].data[0].value.length === 0) {
      throw new Error(`Product with code ${newProductCode} not found`);
    }
  
    const newProductId = Number(productIds.array[0].data[0].value[0].int[0]);
  
    // Get product details to construct the new name and get other product properties
    const productDetails = await this.xmlRpc('object', 'execute', [
      this.session.db,
      this.session.uid,
      this.session.id,
      'product.product',
      'read',
      [newProductId],
      ['name', 'name_template', 'default_code', 'list_price']
    ]);

    // More robust checking of the product details response
    if (!productDetails || !productDetails.array || !productDetails.array[0] || 
        !productDetails.array[0].data || !productDetails.array[0].data[0] || 
        !productDetails.array[0].data[0].value || !productDetails.array[0].data[0].value[0] ||
        !productDetails.array[0].data[0].value[0].struct || !productDetails.array[0].data[0].value[0].struct[0] ||
        !productDetails.array[0].data[0].value[0].struct[0].member) {
      throw new Error(`Failed to retrieve details for product with code ${newProductCode}`);
    }

    // Extract all product properties
    const productProps = productDetails.array[0].data[0].value[0].struct[0].member
      .reduce((acc: any, m: any) => {
        const key = m.name[0];
        const value = m.value[0];
        
        // Handle other properties
        acc[key] = value.string ? value.string[0] : 
                  value.int ? Number(value.int[0]) : 
                  value.double ? Number(value.double[0]) : null;
        return acc;
      }, {});

    // Use name_template if available, otherwise fall back to name
    const productName = productProps.name_template || productProps.name;
    const newName = `[${productProps.default_code}] ${productName}`;

    // Update the order line directly using the provided ID
    try {
      // This is a single transaction that updates both product_id and name atomically
      const updateData: any = {
        'product_id': newProductId,
        'name': newName
      };
      
      // Only include price if it exists in the product details
      if (productProps.list_price !== undefined) {
        updateData.price_unit = productProps.list_price;
      }
      
      await this.xmlRpc('object', 'execute', [
        this.session.db,
        this.session.uid,
        this.session.id,
        'sale.order.line',
        'write',
        [orderLineId],
        updateData
      ]);
    } catch (error) {
      throw new Error(`Failed to update order line: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getProductDetailsByCode(productCode: string): Promise<ProductDetails | null> {
    if (!this.session) {
      throw new Error('Not authenticated');
    }

    const productIds = await this.xmlRpc('object', 'execute', [
      this.session.db,
      this.session.uid,
      this.session.id,
      'product.product',
      'search',
      [['default_code', '=', productCode]]
    ]);

    if (!productIds || !productIds.array || !productIds.array[0] || 
        !productIds.array[0].data || !productIds.array[0].data[0] || 
        !productIds.array[0].data[0].value || productIds.array[0].data[0].value.length === 0) {
      return null;
    }

    const productId = Number(productIds.array[0].data[0].value[0].int[0]);

    const productDetails = await this.xmlRpc('object', 'execute', [
      this.session.db,
      this.session.uid,
      this.session.id,
      'product.product',
      'read',
      [productId],
      ['id', 'name', 'name_template', 'default_code', 'list_price']
    ]);

    if (!productDetails || !productDetails.array || !productDetails.array[0] || 
        !productDetails.array[0].data || !productDetails.array[0].data[0] || 
        !productDetails.array[0].data[0].value || !productDetails.array[0].data[0].value[0] ||
        !productDetails.array[0].data[0].value[0].struct || !productDetails.array[0].data[0].value[0].struct[0] ||
        !productDetails.array[0].data[0].value[0].struct[0].member) {
      return null;
    }

    const productProps = productDetails.array[0].data[0].value[0].struct[0].member
      .reduce((acc: any, m: any) => {
        const key = m.name[0];
        const value = m.value[0];
        
        // Handle other properties
        acc[key] = value.string ? value.string[0] : 
                  value.int ? Number(value.int[0]) : 
                  value.double ? Number(value.double[0]) : null;
        return acc;
      }, {});

    return {
      id: productProps.id,
      code: productProps.default_code,
      name: productProps.name_template || productProps.name,
      name_template: productProps.name_template,
      price: productProps.list_price
    };
  }

  private async parseXmlResponse(xmlString: string) {
    const result = await parseStringPromise(xmlString);
    if (result.methodResponse.fault) {
      throw new Error(result.methodResponse.fault[0].value[0].struct[0].member[0].value[0].string[0]);
    }
    return result.methodResponse.params[0].param[0].value[0];
  }

  private async xmlRpc(service: 'db'|'common'|'object', method: string, params: any[] = []) {
    const xmlBody = this.createXmlRpcRequest(method, params);
    const response = await this.xmlRpcClient.post(this.getEndpoint(service), xmlBody);
    return this.parseXmlResponse(response.data);
  }

  async listDatabases(): Promise<string[]> {
    const response = await this.xmlRpc('db', 'list');
    // Handle both array and string response formats
    if (typeof response === 'string') {
      return [response];
    }
    if (!response.array || !response.array[0].data || !response.array[0].data[0].value) {
      return [];
    }
    const databases = response.array[0].data[0].value.map(
      (item: any) => item.string ? item.string[0] : item
    );
    return databases;
  }

  async login(credentials: LoginCredentials): Promise<Session> {
    const uid = await this.xmlRpc('common', 'login', [
      credentials.db,
      credentials.username,
      credentials.password
    ]);

    if (!uid) {
      throw new Error('Authentication failed');
    }

    this.session = {
      id: credentials.password,
      db: credentials.db,
      uid: Number(uid.int ? uid.int[0] : uid),
      username: credentials.username
    };

    return this.session;
}

  async getOpenSaleOrders(): Promise<SaleOrder[]> {
    if (!this.session) {
      throw new Error('Not authenticated');
    }

    const orderIdsResponse = await this.xmlRpc('object', 'execute', [
      this.session.db,
      this.session.uid,
      this.session.id,
      'sale.order',
      'search',
      [['state', 'in', ['draft', 'sent', 'progress']]]
    ]);

    const orderIds = orderIdsResponse.array[0].data[0].value.map(
      (item: any) => Number(item.int ? item.int[0] : item)
    );

    if (!orderIds || orderIds.length === 0) {
      return [];
    }

    const ordersResponse = await this.xmlRpc('object', 'execute', [
      this.session.db,
      this.session.uid,
      this.session.id,
      'sale.order',
      'read',
      orderIds,
      ['id', 'name', 'partner_id', 'state']
    ]);

    const orders = ordersResponse.array[0].data[0].value.map((item: any) => {
      const struct = item.struct[0].member;
      const order: any = {};
      struct.forEach((member: any) => {
        const key = member.name[0];
        const value = member.value[0];
        order[key] = value.int ? Number(value.int[0]) : 
                    value.string ? value.string[0] : 
                    value.array ? [Number(value.array[0].data[0].value[0].int[0]), 
                                 value.array[0].data[0].value[1].string[0]] : null;
      });
      return order;
    });

    return orders;
  }

  async getSaleOrderLines(orderId: number): Promise<OrderLine[]> {
    if (!this.session) {
      throw new Error('Not authenticated');
    }

    const lineIdsResponse = await this.xmlRpc('object', 'execute', [
      this.session.db,
      this.session.uid,
      this.session.id,
      'sale.order.line',
      'search',
      [['order_id', '=', orderId]]
    ]);

    const lineIds = lineIdsResponse.array[0].data[0].value.map(
      (item: any) => Number(item.int ? item.int[0] : item)
    );

    if (!lineIds || lineIds.length === 0) {
      return [];
    }

    const linesResponse = await this.xmlRpc('object', 'execute', [
      this.session.db,
      this.session.uid,
      this.session.id,
      'sale.order.line',
      'read',
      lineIds,
      ['id', 'product_id', 'product_uom_qty', 'name', 'price_unit']
    ]);

    const lines = linesResponse.array[0].data[0].value.map((item: any) => {
      const struct = item.struct[0].member;
      const line: any = {};
      struct.forEach((member: any) => {
        const key = member.name[0];
        const value = member.value[0];
        if (key === 'product_uom_qty' && value.double) {
          line[key] = Number(value.double[0]);
        } else if (key === 'price_unit' && value.double) {
          line[key] = Number(value.double[0]);
        } else {
          line[key] = value.int ? Number(value.int[0]) : 
                     value.string ? value.string[0] : 
                     value.array ? [Number(value.array[0].data[0].value[0].int[0]), 
                                  value.array[0].data[0].value[1].string[0]] : null;
        }
      });
      return line;
    });

    return lines;
  }
}