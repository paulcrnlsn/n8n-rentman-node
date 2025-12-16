import type {
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	IDataObject,
	IHttpRequestMethods,
} from 'n8n-workflow';
import { NodeConnectionTypes, NodeOperationError } from 'n8n-workflow';

export class Rentman implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Rentman',
		name: 'rentman',
		icon: 'file:rentman.svg',
		group: ['transform'],
		version: 1,
		subtitle: '={{$parameter["operation"] + ": " + $parameter["resource"]}}',
		description: 'Interact with Rentman API',
		defaults: {
			name: 'Rentman API',
		},
		inputs: [NodeConnectionTypes.Main],
		outputs: [NodeConnectionTypes.Main],
		usableAsTool: true,
		credentials: [
			{
				name: 'rentmanApi',
				required: true,
			},
		],
		requestDefaults: {
			baseURL: 'https://api.rentman.net',
			headers: {
				Accept: 'application/json',
				'Content-Type': 'application/json',
			},
		},
		properties: [
			{
				displayName: 'Resource',
				name: 'resource',
				type: 'options',
				noDataExpression: true,
				options: [
					{
						name: 'Accessory',
						value: 'accessory',
					},
				],
				default: 'accessory',
			},
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: {
					show: {
						resource: ['accessory'],
					},
				},
				options: [
					{
						name: 'Get Many',
						value: 'getAll',
						description: 'Get many accessories',
						action: 'Get many accessories',
					},
				],
				default: 'getAll',
			},
			// Accessory:getAll
			{
				displayName: 'Return All',
				name: 'returnAll',
				type: 'boolean',
				displayOptions: {
					show: {
						resource: ['accessory'],
						operation: ['getAll'],
					},
				},
				default: false,
				description: 'Whether to return all results or only up to a given limit',
			},
			{
				displayName: 'Limit',
				name: 'limit',
				type: 'number',
				displayOptions: {
					show: {
						resource: ['accessory'],
						operation: ['getAll'],
						returnAll: [false],
					},
				},
				typeOptions: {
					minValue: 1,
					maxValue: 300,
				},
				default: 50,
				description: 'Max number of results to return',
			},
			{
				displayName: 'Additional Fields',
				name: 'additionalFields',
				type: 'collection',
				placeholder: 'Add Field',
				default: {},
				displayOptions: {
					show: {
						resource: ['accessory'],
						operation: ['getAll'],
					},
				},
				options: [
					{
						displayName: 'Fields',
						name: 'fields',
						type: 'string',
						default: '',
						description: 'Comma-separated list of fields to return (e.g., displayname,ID)',
					},
					{
						displayName: 'Sort',
						name: 'sort',
						type: 'string',
						default: '',
						description: 'Sort fields (e.g., +ID,-name)',
					},
					{
						displayName: 'Offset',
						name: 'offset',
						type: 'number',
						default: 0,
						description: 'Number of items to skip',
					},
				],
			},
		],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];
		const resource = this.getNodeParameter('resource', 0);
		const operation = this.getNodeParameter('operation', 0);

		for (let i = 0; i < items.length; i++) {
			try {
				if (resource === 'accessory') {
					if (operation === 'getAll') {
						const returnAll = this.getNodeParameter('returnAll', i);
						const additionalFields = this.getNodeParameter('additionalFields', i);

						const qs: IDataObject = {};

						if (!returnAll) {
							qs.limit = this.getNodeParameter('limit', i);
						} else {
							qs.limit = 300; // Max allowed by API
						}

						if (additionalFields.fields) {
							qs.fields = additionalFields.fields;
						}

						if (additionalFields.sort) {
							qs.sort = additionalFields.sort;
						}

						if (additionalFields.offset) {
							qs.offset = additionalFields.offset;
						}

						let responseData;

						if (returnAll) {
							// Pagination logic for returnAll
							const allData: IDataObject[] = [];
							let offset = (additionalFields.offset as number) || 0;
							let hasMore = true;

							while (hasMore) {
								qs.offset = offset;
								qs.limit = 300;

								responseData = await this.helpers.httpRequestWithAuthentication.call(
									this,
									'rentmanApi',
									{
										method: 'GET' as IHttpRequestMethods,
										url: '/accessories',
										qs,
									},
								);

								if (responseData.data && Array.isArray(responseData.data)) {
									allData.push(...responseData.data);

									// Check if we got fewer items than requested, meaning we've reached the end
									if (responseData.data.length < 300) {
										hasMore = false;
									} else {
										offset += 300;
									}
								} else {
									hasMore = false;
								}
							}

							responseData = { data: allData, itemCount: allData.length };
						} else {
							responseData = await this.helpers.httpRequestWithAuthentication.call(
								this,
								'rentmanApi',
								{
									method: 'GET' as IHttpRequestMethods,
									url: '/accessories',
									qs,
								},
							);
						}

						// Return the data array
						if (responseData.data && Array.isArray(responseData.data)) {
							const executionData = this.helpers.constructExecutionMetaData(
								this.helpers.returnJsonArray(responseData.data),
								{ itemData: { item: i } },
							);
							returnData.push(...executionData);
						}
					}
				}
			} catch (error) {
				if (this.continueOnFail()) {
					returnData.push({
						json: {
							error: error.message,
						},
						pairedItem: { item: i },
					});
					continue;
				}
				throw new NodeOperationError(this.getNode(), error, {
					itemIndex: i,
				});
			}
		}

		return [returnData];
	}
}
