import type {
	IAuthenticateGeneric,
	Icon,
	ICredentialTestRequest,
	ICredentialType,
	INodeProperties,
} from 'n8n-workflow';

export class RentmanApi implements ICredentialType {
	name = 'rentmanApi';

	displayName = 'Rentman API';

	icon: Icon = 'file:../icons/rentman.svg';

	documentationUrl = 'https://api.rentman.net/';

	properties: INodeProperties[] = [
		{
			displayName: 'JWT Token',
			name: 'jwtToken',
			type: 'string',
			typeOptions: { password: true },
			default: '',
			description:
				'JWT token generated in the extensions tab in configuration in the Rentman application',
		},
	];

	authenticate: IAuthenticateGeneric = {
		type: 'generic',
		properties: {
			headers: {
				Authorization: '=Bearer {{$credentials?.jwtToken}}',
				'Content-Type': 'application/json',
			},
		},
	};

	test: ICredentialTestRequest = {
		request: {
			baseURL: 'https://api.rentman.net',
			url: '/accessories',
			method: 'GET',
		},
	};
}
