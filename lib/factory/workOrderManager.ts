import { prisma } from '../db';
import { SingleLessonEWO } from '../schemas/ewo';

export class WorkOrderManager {
  /**
   * Create a new Education Work Order
   */
  async createEWO(ewoData: Partial<SingleLessonEWO>) {
    const ewoId = await this.generateEWOId();

    const ewo = await prisma.educationWorkOrder.create({
      data: {
        ewoId,
        ewo_type: ewoData.ewo_type || 'SINGLE_LESSON',
        status: 'IDEA',
        priority: ewoData.metadata?.priority || 'MEDIUM',
        target: ewoData.target as any,
        constraints: ewoData.constraints as any,
        artifacts: {},
        history: [],
        initiator: ewoData.metadata?.initiator,
        deadline: ewoData.metadata?.deadline ? new Date(ewoData.metadata.deadline) : null,
      },
    });
    
    return ewo;
  }

  /**
   * Update EWO status and add to history
   */
  async updateStatus(ewoId: string, newStatus: string, notes?: string) {
    const ewo = await prisma.educationWorkOrder.findUnique({
      where: { ewoId },
    });
    
    if (!ewo) throw new Error(`EWO ${ewoId} not found`);
    
    const historyEntry = {
      timestamp: new Date().toISOString(),
      status_before: ewo.status,
      status_after: newStatus,
      notes: notes || '',
    };
    
    const currentHistory = Array.isArray(ewo.history) ? ewo.history : [];
    const updatedHistory = [...currentHistory, historyEntry];
    
    return prisma.educationWorkOrder.update({
      where: { ewoId },
      data: {
        status: newStatus,
        history: updatedHistory,
      },
    });
  }

  /**
   * Store agent output in artifacts
   */
  async storeArtifact(ewoId: string, agentType: string, output: any) {
    const ewo = await prisma.educationWorkOrder.findUnique({
      where: { ewoId },
    });
    
    if (!ewo) throw new Error(`EWO ${ewoId} not found`);
    
    const artifacts = ewo.artifacts as any;
    artifacts[agentType] = output;
    
    return prisma.educationWorkOrder.update({
      where: { ewoId },
      data: { artifacts },
    });
  }

  /**
   * Generate next EWO ID (EWO-00001, EWO-00002, etc.)
   */
  private async generateEWOId(): Promise<string> {
    const lastEWO = await prisma.educationWorkOrder.findFirst({
      orderBy: { createdAt: 'desc' },
    });
    
    if (!lastEWO) return 'EWO-00001';
    
    const lastNumber = parseInt(lastEWO.ewoId.split('-')[1]);
    const nextNumber = lastNumber + 1;
    return `EWO-${String(nextNumber).padStart(5, '0')}`;
  }

  /**
   * Get all EWOs by status
   */
  async getEWOsByStatus(status: string) {
    return prisma.educationWorkOrder.findMany({
      where: { status },
      orderBy: { priority: 'desc' },
    });
  }
}
