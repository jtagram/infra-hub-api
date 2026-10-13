import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsInt, IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { KubernetesAction } from './kubernates-hub-api.playbook';

export class ManageKubernetesDto {
	@ApiProperty({
		description: 'Number of the ticket that requested this operation.',
		example: 1234,
		type: 'integer',
	})
	@IsNotEmpty()
	@IsInt()
	numberOfTickets!: number;

	@ApiProperty({
		description: 'Kubernetes namespace the manifest is applied to.',
		example: 'production',
		maxLength: 63,
	})
	@IsString()
	@IsNotEmpty()
	@MaxLength(63)
	namespace!: string;

	@ApiProperty({
		description: '`kubectl` action to run with the manifest.',
		enum: KubernetesAction,
		enumName: 'KubernetesAction',
		example: KubernetesAction.APPLY,
	})
	@IsEnum(KubernetesAction)
	action!: KubernetesAction;

	@ApiProperty({
		description:
			'Kubernetes manifest as YAML/JSON text. Free-form: it is piped to `kubectl` as-is.',
		example: 'apiVersion: v1\nkind: ConfigMap\nmetadata:\n  name: demo\ndata:\n  key: value',
		maxLength: 20000,
	})
	@IsString()
	@IsNotEmpty()
	@MaxLength(20000)
	manifest!: string;
}

export class ListDeploymentsDto {
	@ApiProperty({
		description: 'Kubernetes namespace whose deployments are listed.',
		example: 'production',
		maxLength: 63,
	})
	@IsString()
	@IsNotEmpty()
	@MaxLength(63)
	namespace!: string;
}

export class ExecuteKubectlCommandDto {
	@ApiProperty({
		description: 'Number of the ticket that requested this operation.',
		example: 1234,
		type: 'integer',
	})
	@IsNotEmpty()
	@IsInt()
	numberOfTickets!: number;

	@ApiProperty({
		description: '`kubectl` command line to execute. Free-form text.',
		example: 'get pods -n production',
		maxLength: 4000,
	})
	@IsString()
	@IsNotEmpty()
	@MaxLength(4000)
	kubectlCommand!: string;
}

/** Documentation-only shape of the `GET list-deployments` response. */
export class ListDeploymentsResponse {
	@ApiProperty({
		description: 'Names of the deployments found in the namespace.',
		type: [String],
		example: ['api', 'worker'],
	})
	deployments!: string[];
}
