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
  product_id: [number, string];
  product_uom_qty: number;
}

export class OpenERPClient {
  private dbClient: AxiosInstance;
  private commonClient: AxiosInstance;
  private objectClient: AxiosInstance;
  public session: Session | null = null;

  constructor(config: OpenERPConfig) {
    const baseUrl = config.baseUrl.replace(/\/+$/, '');
    
    const axiosConfig = {
      headers: {
        'Content-Type': 'text/xml',
        'Accept': 'text/xml'
      },
      validateStatus: () => true
    };

    this.dbClient = axios.create({
      baseURL: `${baseUrl}/xmlrpc/db`,
      ...axiosConfig
    });
    this.commonClient = axios.create({
      baseURL: `${baseUrl}/xmlrpc/common`,
      ...axiosConfig
    });
    this.objectClient = axios.create({
      baseURL: `${baseUrl}/xmlrpc/object`,
      ...axiosConfig
    });
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

  async updateOrderLineProduct(orderId: number, oldProductId: number, newProductCode: string): Promise<void> {
    if (!this.session) {
      throw new Error('Not authenticated');
    }
  
    // First, search for the product with the given code
    const productIds = await this.xmlRpc(this.objectClient, 'execute', [
      this.session.db,
      this.session.uid,
      this.session.id,
      'product.product',
      'search',
      [['default_code', '=', newProductCode]]
    ]);
  
    if (!productIds || productIds.array[0].data[0].value.length === 0) {
      throw new Error('Product not found');
    }
  
    const newProductId = Number(productIds.array[0].data[0].value[0].int[0]);
  
    // Get product details to construct the new name
    const productDetails = await this.xmlRpc(this.objectClient, 'execute', [
      this.session.db,
      this.session.uid,
      this.session.id,
      'product.product',
      'read',
      [newProductId],
      ['name', 'default_code']
    ]);

    const productName = productDetails.array[0].data[0].value[0].struct[0].member
      .reduce((acc: any, m: any) => {
        acc[m.name[0]] = m.value[0].string ? m.value[0].string[0] : '';
        return acc;
      }, {});

    const newName = `[${productName.default_code}] ${productName.name}`;

    // Search for the specific order line using both order_id and product_id
    const lineIds = await this.xmlRpc(this.objectClient, 'execute', [
      this.session.db,
      this.session.uid,
      this.session.id,
      'sale.order.line',
      'search',
      [
        ['order_id', '=', orderId], 
        ['product_id', '=', oldProductId]
      ],
      1  // Limit to 1 result
    ]);

    if (!lineIds || lineIds.array[0].data[0].value.length === 0) {
      throw new Error('Order line not found');
    }

    // Single update with both product and name
    await this.xmlRpc(this.objectClient, 'execute', [
      this.session.db,
      this.session.uid,
      this.session.id,
      'sale.order.line',
      'write',
      [Number(lineIds.array[0].data[0].value[0].int[0])],
      { 
        'product_id': newProductId,
        'name': newName
      }
    ]);
  }

  private async parseXmlResponse(xmlString: string) {
    const result = await parseStringPromise(xmlString);
    if (result.methodResponse.fault) {
      throw new Error(result.methodResponse.fault[0].value[0].struct[0].member[0].value[0].string[0]);
    }
    return result.methodResponse.params[0].param[0].value[0];
  }

  private async xmlRpc(client: AxiosInstance, method: string, params: any[] = []) {
    const xmlBody = this.createXmlRpcRequest(method, params);
    const response = await client.post('', xmlBody);
    return this.parseXmlResponse(response.data);
  }

  async listDatabases(): Promise<string[]> {
    const response = await this.xmlRpc(this.dbClient, 'list');
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
    const uid = await this.xmlRpc(this.commonClient, 'login', [
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

    const orderIdsResponse = await this.xmlRpc(this.objectClient, 'execute', [
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

    const ordersResponse = await this.xmlRpc(this.objectClient, 'execute', [
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

    const lineIdsResponse = await this.xmlRpc(this.objectClient, 'execute', [
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

    const linesResponse = await this.xmlRpc(this.objectClient, 'execute', [
      this.session.db,
      this.session.uid,
      this.session.id,
      'sale.order.line',
      'read',
      lineIds,
      ['product_id', 'product_uom_qty']
    ]);

    const lines = linesResponse.array[0].data[0].value.map((item: any) => {
      const struct = item.struct[0].member;
      const line: any = {};
      struct.forEach((member: any) => {
        const key = member.name[0];
        const value = member.value[0];
        if (key === 'product_uom_qty' && value.double) {
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