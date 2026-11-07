import { AnsibleExecutionResult } from '../ansible/ansible.service';
import { OperationResult, OperationResultBuilder } from '../../common/dto/operation-result.dto';
import { ResponseBody } from '../../common/dto/response-body.dto';
import {
	InfrastructureDepartment,
	InfrastructureOperationsLogEntity,
	InfrastructureOperationsLogEntityBuilder,
} from '../../common/database/infrastructure-operatios-log.entity';
import {
	ExecuteKubectlCommandDto,
	ListDeploymentsResponse,
	ManageKubernetesDto,
} from './kubernates-hub-api.dto';
import {
	KubectlCommandPlaybookInput,
	KubectlCommandPlaybookInputBuilder,
	KubernetesManifestPlaybookInput,
	KubernetesManifestPlaybookInputBuilder,
} from './kubernates-hub-api.playbook';

const DEPLOYMENTS_RETRIEVED_MESSAGE = 'Deployments retrieved successfully';
const MANIFEST_MANAGED_MESSAGE = 'Kubernetes manifest operation executed';
const KUBECTL_EXECUTED_MESSAGE = 'Kubectl command executed';

export class KubernetesHubApiMapper {
	static toKubernetesManifestPlaybookInput(
		dto: ManageKubernetesDto,
	): KubernetesManifestPlaybookInput {
		return new KubernetesManifestPlaybookInputBuilder()
			.withNamespace(dto.namespace)
			.withAction(dto.action)
			.withManifest(dto.manifest)
			.build();
	}

	static toOperationsLogEntity(
		dto: ManageKubernetesDto,
		result: AnsibleExecutionResult,
	): InfrastructureOperationsLogEntity {
		return new InfrastructureOperationsLogEntityBuilder()
			.withDepartment(InfrastructureDepartment.KUBERNETES)
			.withNumberOfTicket(dto.numberOfTickets)
			.withInstruction(JSON.stringify({ action: dto.action, manifest: dto.manifest }))
			.withResponse(JSON.stringify(result))
			.build();
	}

	static toKubectlCommandPlaybookInput(dto: ExecuteKubectlCommandDto): KubectlCommandPlaybookInput {
		return new KubectlCommandPlaybookInputBuilder().withKubectlCommand(dto.kubectlCommand).build();
	}

	static toKubectlCommandOperationsLogEntity(
		dto: ExecuteKubectlCommandDto,
		result: AnsibleExecutionResult,
	): InfrastructureOperationsLogEntity {
		return new InfrastructureOperationsLogEntityBuilder()
			.withDepartment(InfrastructureDepartment.KUBERNETES)
			.withNumberOfTicket(dto.numberOfTickets)
			.withInstruction(JSON.stringify({ kubectlCommand: dto.kubectlCommand }))
			.withResponse(JSON.stringify(result))
			.build();
	}

	static toListDeploymentsResponse(deployments: string[]): ResponseBody<ListDeploymentsResponse> {
		return ResponseBody.success(DEPLOYMENTS_RETRIEVED_MESSAGE, { deployments });
	}

	static toManageManifestResponse(
		result: AnsibleExecutionResult,
		logId: string,
	): ResponseBody<OperationResult> {
		return ResponseBody.success(MANIFEST_MANAGED_MESSAGE, toOperationResult(result, logId));
	}

	static toKubectlCommandResponse(
		result: AnsibleExecutionResult,
		logId: string,
	): ResponseBody<OperationResult> {
		return ResponseBody.success(KUBECTL_EXECUTED_MESSAGE, toOperationResult(result, logId));
	}
}

function toOperationResult(result: AnsibleExecutionResult, logId: string): OperationResult {
	return new OperationResultBuilder().withExecutionResult(result).withLogId(logId).build();
}
