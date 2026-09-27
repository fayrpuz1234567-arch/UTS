import { ContractRepository } from '../repositories/contract.repository';
import { Contract, CreateContractDTO, UpdateContractDTO } from '../models/contracts.model';
import { AppError } from '../../../core/middleware/error.middleware';
import { logger } from '../../../core/utils/logger';

export class ContractService {
  constructor(private contractRepo: ContractRepository) {}

  async createContract(data: CreateContractDTO, createdBy: string): Promise<Contract> {
    const existing = await this.contractRepo.findByContractNumber(data.contractNumber);
    if (existing) {
      throw new AppError('Contract with this number already exists', 409);
    }

    const contract = await this.contractRepo.create({
      ...data,
      status: 'draft',
      version: 1,
      isDeleted: false,
      createdBy
    });

    logger.info(`Contract created: ${contract.contractNumber} (${contract.id})`);
    return contract;
  }

  async getContract(id: string): Promise<Contract> {
    const contract = await this.contractRepo.findById(id);
    if (!contract) {
      throw new AppError('Contract not found', 404);
    }
    return contract;
  }

  async getAllContracts(filter?: any): Promise<Contract[]> {
    return this.contractRepo.findAll({ filter });
  }

  async updateContract(id: string, data: UpdateContractDTO, updatedBy: string): Promise<Contract> {
    await this.getContract(id);
    const updated = await this.contractRepo.update(id, { ...data, updatedBy });
    if (!updated) {
      throw new AppError('Failed to update contract', 500);
    }
    logger.info(`Contract updated: ${updated.contractNumber}`);
    return updated;
  }

  async deleteContract(id: string): Promise<boolean> {
    await this.getContract(id);
    return this.contractRepo.softDelete(id);
  }

  async activateContract(id: string, updatedBy: string): Promise<Contract> {
    const contract = await this.getContract(id);
    if (contract.status !== 'draft') {
      throw new AppError('Only draft contracts can be activated', 400);
    }

    const updated = await this.contractRepo.updateStatus(id, 'active');
    if (!updated) {
      throw new AppError('Failed to activate contract', 500);
    }
    logger.info(`Contract activated: ${updated.contractNumber}`);
    return updated;
  }

  async cancelContract(id: string, updatedBy: string): Promise<Contract> {
    const contract = await this.getContract(id);
    if (contract.status === 'cancelled' || contract.status === 'terminated') {
      throw new AppError('Contract already cancelled/terminated', 400);
    }

    const updated = await this.contractRepo.updateStatus(id, 'cancelled');
    if (!updated) {
      throw new AppError('Failed to cancel contract', 500);
    }
    logger.info(`Contract cancelled: ${updated.contractNumber}`);
    return updated;
  }

  async renewContract(id: string, newEndDate: string, updatedBy: string): Promise<Contract> {
    const contract = await this.getContract(id);
    if (contract.status !== 'active') {
      throw new AppError('Only active contracts can be renewed', 400);
    }

    const updated = await this.contractRepo.renewContract(id, newEndDate);
    if (!updated) {
      throw new AppError('Failed to renew contract', 500);
    }
    logger.info(`Contract renewed: ${updated.contractNumber}`);
    return updated;
  }

  async getContractsByType(type: string): Promise<Contract[]> {
    return this.contractRepo.findByType(type);
  }

  async getContractsByStatus(status: string): Promise<Contract[]> {
    return this.contractRepo.findByStatus(status);
  }

  async getActiveContracts(): Promise<Contract[]> {
    return this.contractRepo.findActive();
  }

  async getExpiredContracts(): Promise<Contract[]> {
    return this.contractRepo.findExpired();
  }

  async getExpiringSoonContracts(days: number = 30): Promise<Contract[]> {
    return this.contractRepo.findExpiringSoon(days);
  }
}