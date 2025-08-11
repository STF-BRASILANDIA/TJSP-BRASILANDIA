// ========================================
// SISTEMA UNIFICADO TJSP BRASILÂNDIA
// Sistema de Sincronização em Tempo Real
// ========================================

class TJSPUnifiedSystem {
    constructor() {
        this.systemData = {
            processes: new Map(),
            users: new Map(),
            notifications: [],
            realTimeUpdates: true,
            lastSync: null
        };
        
        this.eventListeners = new Map();
        this.syncInterval = null;
        
        this.init();
    }

    // === INICIALIZAÇÃO ===
    init() {
        this.loadSystemData();
        this.startRealTimeSync();
        this.setupEventHandlers();
        
        console.log('🏛️ Sistema Unificado TJSP Brasilândia iniciado');
        console.log('⚖️ Sincronização em tempo real ativada');
    }

    // === SISTEMA DE PROCESSOS ===
    createProcess(processData) {
        const processId = this.generateId('PROC');
        const process = {
            id: processId,
            numero: this.generateProcessNumber(),
            ...processData,
            status: 'pendente',
            createdAt: new Date(),
            lastUpdate: new Date(),
            history: []
        };

        this.systemData.processes.set(processId, process);
        this.addToHistory(processId, 'Processo criado', processData.autor || 'Sistema');
        this.broadcastUpdate('process_created', { processId, process });
        
        return processId;
    }

    updateProcess(processId, updates, userId = 'Sistema') {
        const process = this.systemData.processes.get(processId);
        if (!process) return false;

        const oldStatus = process.status;
        Object.assign(process, updates, { lastUpdate: new Date() });
        
        this.addToHistory(processId, `Status alterado: ${oldStatus} → ${process.status}`, userId);
        this.broadcastUpdate('process_updated', { processId, process, updates });
        
        return true;
    }

    assumeProcess(processId, judgeId, judgeName) {
        const process = this.systemData.processes.get(processId);
        if (!process || process.status !== 'pendente') return false;

        const updates = {
            status: 'andamento',
            juiz: judgeId,
            juizNome: judgeName,
            dataAssuncao: new Date()
        };

        this.updateProcess(processId, updates, judgeName);
        this.addToHistory(processId, `Processo assumido por ${judgeName}`, judgeName);
        
        // Notificar todos os portais
        this.createNotification({
            type: 'process_assumed',
            title: 'Processo Assumido',
            message: `${judgeName} assumiu o processo ${process.numero}`,
            processId: processId,
            targetPortals: ['all']
        });

        return true;
    }

    requestLawyer(processId, judgeId, lawyerId, reason) {
        const process = this.systemData.processes.get(processId);
        if (!process) return false;

        const requestId = this.generateId('REQ');
        const request = {
            id: requestId,
            processId: processId,
            judgeId: judgeId,
            lawyerId: lawyerId,
            reason: reason,
            status: 'pendente',
            createdAt: new Date()
        };

        // Adicionar solicitação ao processo
        if (!process.lawyerRequests) process.lawyerRequests = [];
        process.lawyerRequests.push(request);

        this.broadcastUpdate('lawyer_requested', { request, process });
        
        // Notificar advogado específico
        this.createNotification({
            type: 'lawyer_request',
            title: 'Solicitação de Advogado',
            message: `Você foi solicitado para o processo ${process.numero}`,
            processId: processId,
            targetUser: lawyerId,
            targetPortals: ['portal-advogado']
        });

        return requestId;
    }

    // === SISTEMA DE USUÁRIOS ===
    loginUser(userData) {
        const userId = userData.id;
        const user = {
            ...userData,
            loginTime: new Date(),
            lastActivity: new Date(),
            online: true
        };

        this.systemData.users.set(userId, user);
        this.broadcastUpdate('user_login', { userId, user });
        
        this.createNotification({
            type: 'user_login',
            title: 'Usuário Conectado',
            message: `${user.name} entrou no sistema`,
            targetPortals: ['portal-stf']
        });

        return true;
    }

    logoutUser(userId) {
        const user = this.systemData.users.get(userId);
        if (user) {
            user.online = false;
            user.logoutTime = new Date();
            
            this.broadcastUpdate('user_logout', { userId, user });
        }
    }

    // === SISTEMA DE DISTRIBUIÇÃO AUTOMÁTICA ===
    autoDistributeProcesses() {
        const pendingProcesses = Array.from(this.systemData.processes.values())
            .filter(p => p.status === 'pendente')
            .sort((a, b) => {
                // Priorizar por urgência
                const urgencyOrder = { 'alta': 3, 'media': 2, 'baixa': 1 };
                return (urgencyOrder[b.urgencia] || 1) - (urgencyOrder[a.urgencia] || 1);
            });

        const availableJudges = Array.from(this.systemData.users.values())
            .filter(u => u.online && u.level >= 4 && u.permissions?.includes('portal-judicial'))
            .filter(u => this.getJudgeWorkload(u.id) < 10); // Máximo 10 processos por juiz

        let distributed = 0;
        
        for (const process of pendingProcesses.slice(0, 5)) { // Máximo 5 por vez
            if (availableJudges.length === 0) break;
            
            // Selecionar juiz com menor carga de trabalho
            const judge = availableJudges.sort((a, b) => 
                this.getJudgeWorkload(a.id) - this.getJudgeWorkload(b.id)
            )[0];

            if (this.assumeProcess(process.id, judge.id, judge.name)) {
                distributed++;
            }
        }

        if (distributed > 0) {
            console.log(`🤖 Distribuição automática: ${distributed} processos distribuídos`);
            this.createNotification({
                type: 'auto_distribution',
                title: 'Distribuição Automática',
                message: `${distributed} processos foram distribuídos automaticamente`,
                targetPortals: ['portal-stf', 'portal-judicial']
            });
        }

        return distributed;
    }

    getJudgeWorkload(judgeId) {
        return Array.from(this.systemData.processes.values())
            .filter(p => p.juiz === judgeId && p.status === 'andamento').length;
    }

    // === SISTEMA DE NOTIFICAÇÕES ===
    createNotification(notificationData) {
        const notification = {
            id: this.generateId('NOT'),
            ...notificationData,
            createdAt: new Date(),
            read: false
        };

        this.systemData.notifications.push(notification);
        this.broadcastUpdate('notification_created', { notification });
        
        return notification.id;
    }

    // === SINCRONIZAÇÃO EM TEMPO REAL ===
    startRealTimeSync() {
        if (this.syncInterval) clearInterval(this.syncInterval);
        
        this.syncInterval = setInterval(() => {
            this.performSync();
            this.autoDistributeProcesses();
            this.updateUserActivity();
        }, 30000); // 30 segundos

        console.log('🔄 Sincronização automática iniciada (30s)');
    }

    performSync() {
        this.systemData.lastSync = new Date();
        
        // Atualizar contadores
        this.updateSystemCounters();
        
        // Limpar notificações antigas (mais de 24h)
        const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
        this.systemData.notifications = this.systemData.notifications
            .filter(n => n.createdAt > oneDayAgo);

        this.broadcastUpdate('system_sync', { 
            timestamp: this.systemData.lastSync,
            counters: this.getSystemCounters()
        });
    }

    updateSystemCounters() {
        const counters = this.getSystemCounters();
        
        // Atualizar elementos na página se existirem
        this.updateElementIfExists('totalProcessosAtivos', counters.processosAtivos);
        this.updateElementIfExists('usuariosOnline', counters.usuariosOnline);
        this.updateElementIfExists('totalRecursosSTF', counters.recursosSTF);
        this.updateElementIfExists('decisoesHoje', counters.decisoesHoje);
    }

    getSystemCounters() {
        const processes = Array.from(this.systemData.processes.values());
        const users = Array.from(this.systemData.users.values());
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        return {
            processosAtivos: processes.filter(p => p.status !== 'concluido').length,
            usuariosOnline: users.filter(u => u.online).length,
            recursosSTF: processes.filter(p => p.tipo === 'Recurso Extraordinário').length,
            decisoesHoje: processes.filter(p => 
                p.status === 'concluido' && 
                new Date(p.lastUpdate) >= today
            ).length
        };
    }

    // === SISTEMA DE EVENTOS ===
    addEventListener(event, callback) {
        if (!this.eventListeners.has(event)) {
            this.eventListeners.set(event, []);
        }
        this.eventListeners.get(event).push(callback);
    }

    broadcastUpdate(event, data) {
        const listeners = this.eventListeners.get(event) || [];
        listeners.forEach(callback => {
            try {
                callback(data);
            } catch (error) {
                console.error(`Erro ao executar callback do evento ${event}:`, error);
            }
        });

        // Também salvar no localStorage para outros portais
        localStorage.setItem('tjsp_last_update', JSON.stringify({
            event,
            data,
            timestamp: new Date()
        }));
    }

    setupEventHandlers() {
        // Escutar mudanças no localStorage (comunicação entre abas)
        window.addEventListener('storage', (e) => {
            if (e.key === 'tjsp_last_update') {
                const update = JSON.parse(e.newValue);
                this.handleExternalUpdate(update);
            }
        });
    }

    handleExternalUpdate(update) {
        // Processar atualizações de outras abas/portais
        console.log('📡 Atualização recebida de outro portal:', update.event);
        
        // Recarregar dados se necessário
        if (['process_created', 'process_updated', 'user_login'].includes(update.event)) {
            this.loadSystemData();
        }
    }

    // === PERSISTÊNCIA DE DADOS ===
    loadSystemData() {
        try {
            const saved = localStorage.getItem('tjsp_system_data');
            if (saved) {
                const data = JSON.parse(saved);
                
                // Converter Maps
                this.systemData.processes = new Map(data.processes || []);
                this.systemData.users = new Map(data.users || []);
                this.systemData.notifications = data.notifications || [];
            }
        } catch (error) {
            console.error('Erro ao carregar dados do sistema:', error);
            this.initializeSampleData();
        }
    }

    saveSystemData() {
        const dataToSave = {
            processes: Array.from(this.systemData.processes.entries()),
            users: Array.from(this.systemData.users.entries()),
            notifications: this.systemData.notifications,
            lastSync: this.systemData.lastSync
        };
        
        localStorage.setItem('tjsp_system_data', JSON.stringify(dataToSave));
    }

    initializeSampleData() {
        console.log('🎯 Inicializando dados de exemplo...');
        
        // Criar processos de exemplo
        this.createProcess({
            tipo: 'Ação Penal',
            autor: 'Ministério Público',
            reu: 'João Silva Santos',
            urgencia: 'alta',
            descricao: 'Ação penal por tráfico de drogas'
        });

        this.createProcess({
            tipo: 'Ação Civil',
            autor: 'Maria Santos',
            reu: 'Empresa XYZ Ltda',
            urgencia: 'media',
            descricao: 'Ação de indenização por danos morais'
        });
    }

    // === UTILIDADES ===
    generateId(prefix = 'ID') {
        return `${prefix}${Date.now()}${Math.floor(Math.random() * 1000)}`;
    }

    generateProcessNumber() {
        const year = new Date().getFullYear();
        const sequential = Math.floor(Math.random() * 999999) + 1000000;
        return `${sequential}-12.${year}.8.26.0001`;
    }

    addToHistory(processId, action, user) {
        const process = this.systemData.processes.get(processId);
        if (process) {
            if (!process.history) process.history = [];
            process.history.push({
                action,
                user,
                timestamp: new Date()
            });
        }
    }

    updateElementIfExists(elementId, value) {
        const element = document.getElementById(elementId);
        if (element) {
            element.textContent = value;
        }
    }

    updateUserActivity() {
        // Atualizar última atividade dos usuários online
        this.systemData.users.forEach(user => {
            if (user.online) {
                user.lastActivity = new Date();
            }
        });
    }

    // === INTERFACE PÚBLICA ===
    getProcesses(filter = {}) {
        let processes = Array.from(this.systemData.processes.values());
        
        if (filter.status) {
            processes = processes.filter(p => p.status === filter.status);
        }
        
        if (filter.juiz) {
            processes = processes.filter(p => p.juiz === filter.juiz);
        }
        
        return processes;
    }

    getUsers(filter = {}) {
        let users = Array.from(this.systemData.users.values());
        
        if (filter.online !== undefined) {
            users = users.filter(u => u.online === filter.online);
        }
        
        if (filter.level) {
            users = users.filter(u => u.level >= filter.level);
        }
        
        return users;
    }

    getNotifications(userId = null) {
        let notifications = this.systemData.notifications;
        
        if (userId) {
            notifications = notifications.filter(n => 
                n.targetUser === userId || 
                n.targetPortals?.includes('all') ||
                (n.targetPortals?.includes('portal-stf') && this.isSTFUser(userId))
            );
        }
        
        return notifications.sort((a, b) => b.createdAt - a.createdAt);
    }

    isSTFUser(userId) {
        const user = this.systemData.users.get(userId);
        return user && user.level >= 10;
    }

    // === CLEANUP ===
    destroy() {
        if (this.syncInterval) {
            clearInterval(this.syncInterval);
        }
        this.saveSystemData();
        console.log('🏛️ Sistema Unificado TJSP finalizado');
    }
}

// === INICIALIZAÇÃO GLOBAL ===
window.TJSPSystem = window.TJSPSystem || new TJSPUnifiedSystem();

// Salvar dados antes de sair
window.addEventListener('beforeunload', () => {
    if (window.TJSPSystem) {
        window.TJSPSystem.saveSystemData();
    }
});

// === FUNCÕES GLOBAIS PARA OS PORTAIS ===
window.TJSP = {
    // Sistema de Processos
    createProcess: (data) => window.TJSPSystem.createProcess(data),
    updateProcess: (id, updates, user) => window.TJSPSystem.updateProcess(id, updates, user),
    assumeProcess: (id, judgeId, judgeName) => window.TJSPSystem.assumeProcess(id, judgeId, judgeName),
    getProcesses: (filter) => window.TJSPSystem.getProcesses(filter),
    
    // Sistema de Usuários
    loginUser: (userData) => window.TJSPSystem.loginUser(userData),
    logoutUser: (userId) => window.TJSPSystem.logoutUser(userId),
    getUsers: (filter) => window.TJSPSystem.getUsers(filter),
    
    // Sistema de Advogados
    requestLawyer: (processId, judgeId, lawyerId, reason) => 
        window.TJSPSystem.requestLawyer(processId, judgeId, lawyerId, reason),
    
    // Notificações
    createNotification: (data) => window.TJSPSystem.createNotification(data),
    getNotifications: (userId) => window.TJSPSystem.getNotifications(userId),
    
    // Eventos
    addEventListener: (event, callback) => window.TJSPSystem.addEventListener(event, callback),
    
    // Utilitários
    getSystemCounters: () => window.TJSPSystem.getSystemCounters(),
    forceSync: () => window.TJSPSystem.performSync()
};

console.log('⚖️ TJSP Brasilândia - Sistema Unificado carregado!');
console.log('🏛️ Todos os portais agora estão sincronizados em tempo real');
