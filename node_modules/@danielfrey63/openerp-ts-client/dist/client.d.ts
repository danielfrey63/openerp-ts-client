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
export declare class OpenERPClient {
    private dbClient;
    private commonClient;
    private objectClient;
    session: Session | null;
    constructor(config: OpenERPConfig);
    private createXmlRpcRequest;
    private serializeParam;
    updateOrderLineProduct(orderId: number, oldProductId: number, newProductCode: string): Promise<void>;
    private parseXmlResponse;
    private xmlRpc;
    listDatabases(): Promise<string[]>;
    login(credentials: LoginCredentials): Promise<Session>;
    getOpenSaleOrders(): Promise<SaleOrder[]>;
    getSaleOrderLines(orderId: number): Promise<OrderLine[]>;
}
