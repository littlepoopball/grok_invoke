document.addEventListener('DOMContentLoaded', () => {
    const chatBox = document.getElementById('chat-box');
    const userInput = document.getElementById('user-input');
    const sendBtn = document.getElementById('send-btn');
    const fileUpload = document.getElementById('file-upload');
    const insuranceFormBtn = document.getElementById('insurance-form-btn');
    const medicalFormBtn = document.getElementById('medical-form-btn');
    const insuranceForm = document.getElementById('insurance-form');
    const medicalForm = document.getElementById('medical-form');
    const insuranceFormContent = document.getElementById('insurance-form-content');
    const medicalFormContent = document.getElementById('medical-form-content');
    const newSessionBtn = document.getElementById('new-session-btn');
    const expertSelect = document.getElementById('expert-select');
    const navbar = document.getElementById('navbar');
    const sidebar = document.querySelector('.sidebar');
    const toggleSidebarBtn = document.querySelector('.toggle-sidebar-btn');
    const toggleSidebarOpenBtn = document.getElementById('toggle-sidebar-open-btn');
    const sessionList = document.getElementById('session-list');
    const errorMessage = document.getElementById('error-message');
    let currentSessionId = null;
    let currentExpert = localStorage.getItem('currentExpert') || 'medical';
    let formSubmitted = false;
    let isBackendHealthy = false;
    const API_URL = 'http://localhost:8000/api/chat';
    const UPLOAD_URL = 'http://localhost:8000/api/upload';
    const MAX_SESSIONS = 50;

    // 初始化专家选择下拉菜单
    function initExpertSelect() {
        if (expertSelect) {
            // 修复：强制同步 currentExpert 和 expertSelect.value
            currentExpert = localStorage.getItem('currentExpert') || 'medical';
            expertSelect.value = currentExpert;
            console.log('初始化专家:', currentExpert); // 调试：确认初始专家
            updateExpertTitle();
            updateFormButtonVisibility();
            expertSelect.addEventListener('change', () => {
                currentExpert = expertSelect.value;
                localStorage.setItem('currentExpert', currentExpert);
                console.log('专家切换为:', currentExpert); // 调试：确认专家切换
                updateExpertTitle();
                updateFormButtonVisibility();
                startNewSession();
                formSubmitted = false;
                gsap.fromTo(expertSelect, 
                    { opacity: 0, scale: 0.95 }, 
                    { opacity: 1, scale: 1, duration: 0.4, ease: 'power2.out' }
                );
            });
        } else {
            console.error('专家选择下拉菜单未找到，检查 ID: expert-select');
            showError('专家选择下拉菜单未找到，请检查页面配置。');
        }
    }

    // 防抖函数
    function debounce(func, wait) {
        let timeout;
        return function (...args) {
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(this, args), wait);
        };
    }

    // 显示错误提示
    function showError(message) {
        if (errorMessage) {
            if (errorMessage.textContent === message) return;
            errorMessage.textContent = message;
            errorMessage.style.display = 'block';
            gsap.fromTo(errorMessage, 
                { opacity: 0, y: 10 }, 
                { opacity: 1, y: 0, duration: 0.3, ease: 'power2.out' }
            );
            setTimeout(() => {
                gsap.to(errorMessage, 
                    { opacity: 0, y: 10, duration: 0.3, ease: 'power2.in', onComplete: () => {
                        errorMessage.style.display = 'none';
                    }
                });
            }, 5000);
        }
    }

    // 初始化界面
    function init() {
        initExpertSelect();
        updateExpertTitle();
        updateFormButtonVisibility();
        updateSessionList();
        adjustChatBoxHeight();
        checkBackendHealth();
        if (sidebar) {
            sidebar.classList.add('expanded');
            sidebar.classList.remove('collapsed');
            sidebar.style.width = '240px';
            sidebar.style.opacity = '1';
            updateSidebarButtonVisibility();
        } else {
            console.error('侧边栏未找到，检查类名: sidebar');
            showError('侧边栏未找到，请检查页面配置。');
        }
        if (toggleSidebarBtn) {
            toggleSidebarBtn.innerHTML = '<i class="fas fa-chevron-left"></i> 收起侧边栏';
            toggleSidebarBtn.replaceWith(toggleSidebarBtn.cloneNode(true));
            document.querySelector('.toggle-sidebar-btn').addEventListener('click', toggleSidebar);
        } else {
            console.error('折叠按钮未找到，检查类名: toggle-sidebar-btn');
            showError('折叠按钮未找到，请检查页面配置。');
        }
        if (toggleSidebarOpenBtn) {
            toggleSidebarOpenBtn.addEventListener('click', toggleSidebar);
        } else {
            console.error('展开侧边栏按钮未找到，检查 ID: toggle-sidebar-open-btn');
            showError('展开侧边栏按钮未找到，请检查页面配置。');
        }
        if (navbar) {
            navbar.style.display = 'flex';
            gsap.from(navbar, { opacity: 0, y: -20, duration: 0.5, ease: 'power2.out' });
        }
        gsap.from('.sidebar', { opacity: 0, x: -20, duration: 0.5, ease: 'power2.out', delay: 0.1 });
        gsap.from('.chat-container', { opacity: 0, x: 20, duration: 0.5, ease: 'power2.out', delay: 0.2 });
        gsap.from('.placeholder', { opacity: 0, y: 10, duration: 0.5, ease: 'power2.out', delay: 0.3 });
    }

    // 折叠/展开侧边栏
    function toggleSidebar() {
        if (!sidebar || !toggleSidebarBtn || !toggleSidebarOpenBtn) {
            showError('侧边栏或按钮未找到，请检查页面配置。');
            return;
        }
        const isCollapsed = sidebar.classList.contains('collapsed');
        sidebar.classList.toggle('collapsed', !isCollapsed);
        sidebar.classList.toggle('expanded', isCollapsed);
        toggleSidebarBtn.innerHTML = isCollapsed 
            ? '<i class="fas fa-chevron-left"></i> 收起侧边栏' 
            : '<i class="fas fa-chevron-right"></i> 展开侧边栏';
        gsap.to(sidebar, {
            width: isCollapsed ? '240px' : '0px',
            opacity: isCollapsed ? 1 : 0,
            duration: 0.3,
            ease: 'power2.out',
            onStart: () => {
                sidebar.style.display = 'flex';
            },
            onComplete: () => {
                if (isCollapsed) {
                    updateSessionListScroll();
                } else {
                    sidebar.style.overflow = 'hidden';
                }
                updateSidebarButtonVisibility();
            }
        });
    }

    // 更新侧边栏按钮可见性
    function updateSidebarButtonVisibility() {
        if (toggleSidebarOpenBtn && toggleSidebarBtn) {
            const isCollapsed = sidebar.classList.contains('collapsed');
            toggleSidebarOpenBtn.style.display = isCollapsed ? 'block' : 'none';
            toggleSidebarBtn.style.display = isCollapsed ? 'none' : 'block';
        }
    }

    // 调整聊天框高度
    function adjustChatBoxHeight() {
        const windowHeight = window.innerHeight;
        chatBox.style.height = `calc(${windowHeight}px - 100px)`;
        chatBox.style.overflowY = 'auto';
    }

    // 更新专家标题
    function updateExpertTitle() {
        const expertTitle = document.getElementById('expert-title');
        if (expertTitle) {
            expertTitle.textContent = currentExpert === 'medical' ? '医疗问诊专家' : '保险资产配置专家';
        }
    }

    // 更新问卷按钮可见性
    const updateFormButtonVisibility = debounce(() => {
        if (insuranceFormBtn && medicalFormBtn) {
            insuranceFormBtn.style.display = currentExpert === 'insurance' ? 'inline-flex' : 'none';
            medicalFormBtn.style.display = currentExpert === 'medical' ? 'inline-flex' : 'none';
        }
    }, 100);

    // 新建会话
    newSessionBtn.addEventListener('click', () => {
        startNewSession();
        formSubmitted = false;
    });

    // 发送消息
    sendBtn.addEventListener('click', () => {
        if (!isBackendHealthy) {
            showError('后端服务不可用，请检查网络连接或联系管理员。');
            appendMessage('assistant', `<div class="assistant-message ${currentExpert}">后端服务不可用，请检查网络连接或联系管理员。</div>`);
            return;
        }
        sendMessage();
    });

    userInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            if (isBackendHealthy) sendMessage();
            else {
                showError('后端服务不可用，请检查网络连接或联系管理员。');
                appendMessage('assistant', `<div class="assistant-message ${currentExpert}">后端服务不可用，请检查网络连接或联系管理员。</div>`);
            }
        }
    });

    async function sendMessage() {
        const input = userInput.value.trim();
        if (!input) {
            showError('请输入您的问题或填写问卷！');
            appendMessage('assistant', `<div class="assistant-message ${currentExpert}">请输入您的问题或填写问卷！</div>`);
            return;
        }

        const placeholder = chatBox.querySelector('.placeholder');
        if (placeholder) placeholder.style.display = 'none';

        appendMessage('user', input);
        userInput.value = '';
        userInput.style.height = '40px';
        toggleInteractionButtons(false, true);

        try {
            console.log('发送消息，专家类型:', currentExpert); // 调试：确认专家类型
            const response = await callBackendApi(input, currentExpert, currentSessionId);
            appendMessage('assistant', `<div class="assistant-message ${currentExpert}">${marked.parse(response.response)}</div>`);
            saveChatHistory(input, response.response, currentExpert);
            updateSessionList();
        } catch (error) {
            const errorMsg = error.message.includes('aborted') 
                ? '请求超时，可能网络不稳定，请检查连接。'
                : error.message.includes('401') || error.message.includes('403') 
                ? 'API密钥无效，请检查或从 https://console.x.ai 获取新密钥。'
                : error.message;
            showError(errorMsg);
            appendMessage('assistant', `<div class="assistant-message ${currentExpert}">错误：${errorMsg}。请稍后重试。</div>`);
            console.error('发送消息失败:', error);
        } finally {
            toggleInteractionButtons(true, false);
            userInput.focus(); // 新增：焦点返回输入框
        }
    }

    // 文件上传
    if (fileUpload) {
        fileUpload.addEventListener('change', async () => {
            if (!isBackendHealthy) {
                showError('后端服务不可用，请检查网络连接或联系管理员。');
                appendMessage('assistant', `<div class="assistant-message ${currentExpert}">后端服务不可用，请检查网络连接或联系管理员。</div>`);
                return;
            }
            const file = fileUpload.files[0];
            if (!file) return;

            const placeholder = chatBox.querySelector('.placeholder');
            if (placeholder) placeholder.style.display = 'none';

            const formData = new FormData();
            formData.append('file', file);
            toggleInteractionButtons(false, true);

            try {
                console.log('上传文件，专家类型:', currentExpert); // 调试：确认专家类型
                const response = await fetch(UPLOAD_URL, {
                    method: 'POST',
                    body: formData,
                    signal: new AbortController().signal
                });
                if (!response.ok) {
                    const errorData = await response.json().catch(() => ({}));
                    throw new Error(errorData.error || `HTTP错误！状态: ${response.status}`);
                }
                const data = await response.json();
                if (data.status === 'error') throw new Error(data.error);
                appendMessage('assistant', `<div class="assistant-message ${currentExpert}">${marked.parse(data.response)}</div>`);
                saveChatHistory(`上传文件: ${file.name}`, data.response, currentExpert);
                updateSessionList();
                fileUpload.value = '';
            } catch (error) {
                const errorMsg = error.message.includes('aborted') 
                    ? '文件上传超时，可能网络不稳定，请检查连接。'
                    : error.message;
                showError(errorMsg);
                appendMessage('assistant', `<div class="assistant-message ${currentExpert}">错误：${errorMsg}。请稍后重试。</div>`);
                console.error('文件上传失败:', error);
            } finally {
                toggleInteractionButtons(true, false);
                userInput.focus(); // 新增：焦点返回输入框
            }
        });
    }

    // 显示保险问卷
    insuranceFormBtn.addEventListener('click', () => {
        if (!insuranceForm || !insuranceFormContent) {
            showError('无法打开保险问卷，请检查页面配置。');
            appendMessage('assistant', `<div class="assistant-message ${currentExpert}">错误：无法打开保险问卷，请检查页面配置。</div>`);
            return;
        }
        insuranceForm.style.display = 'flex';
        insuranceForm.classList.add('show');
        gsap.fromTo('#insurance-form', 
            { opacity: 0, scale: 0.95 }, 
            { opacity: 1, scale: 1, duration: 0.4, ease: 'power2.out' }
        );
    });

    // 取消保险问卷
    const cancelInsuranceForm = () => {
        if (!insuranceForm) {
            showError('保险问卷表单未找到，请检查页面配置。');
            return;
        }
        gsap.to('#insurance-form', { 
            opacity: 0, 
            scale: 0.95, 
            duration: 0.3, 
            ease: 'power2.in', 
            onComplete: () => {
                insuranceForm.style.display = 'none';
                insuranceForm.classList.remove('show');
                insuranceFormContent.reset();
                insuranceForm.style.opacity = '1';
                userInput.focus(); // 新增：焦点返回输入框
            } 
        });
    };
    if (document.getElementById('cancel-insurance-form-btn')) {
        document.getElementById('cancel-insurance-form-btn').addEventListener('click', cancelInsuranceForm);
    }
    if (document.getElementById('cancel-insurance-form-btn-secondary')) {
        document.getElementById('cancel-insurance-form-btn-secondary').addEventListener('click', cancelInsuranceForm);
    }

    // 显示医疗问卷
    medicalFormBtn.addEventListener('click', () => {
        if (!medicalForm || !medicalFormContent) {
            showError('无法打开医疗问卷，请检查页面配置。');
            appendMessage('assistant', `<div class="assistant-message ${currentExpert}">错误：无法打开医疗问卷，请检查页面配置。</div>`);
            return;
        }
        medicalForm.style.display = 'flex';
        medicalForm.classList.add('show');
        gsap.fromTo('#medical-form', 
            { opacity: 0, scale: 0.95 }, 
            { opacity: 1, scale: 1, duration: 0.4, ease: 'power2.out' }
        );
    });

    // 取消医疗问卷
    const cancelMedicalForm = () => {
        if (!medicalForm) {
            showError('医疗问卷表单未找到，请检查页面配置。');
            return;
        }
        gsap.to('#medical-form', { 
            opacity: 0, 
            scale: 0.95, 
            duration: 0.3, 
            ease: 'power2.in', 
            onComplete: () => {
                medicalForm.style.display = 'none';
                medicalForm.classList.remove('show');
                medicalFormContent.reset();
                medicalForm.style.opacity = '1';
                userInput.focus(); // 新增：焦点返回输入框
            } 
        });
    };
    if (document.getElementById('cancel-medical-form-btn')) {
        document.getElementById('cancel-medical-form-btn').addEventListener('click', cancelMedicalForm);
    }
    if (document.getElementById('cancel-medical-form-btn-secondary')) {
        document.getElementById('cancel-medical-form-btn-secondary').addEventListener('click', cancelMedicalForm);
    }

    // 验证保险问卷数据
    function validateInsuranceFormData(formData) {
        if (formData.age < 18 || formData.age > 100) {
            return '年龄必须在18至100岁之间';
        }
        if (formData.income < 0) {
            return '年收入不能为负数';
        }
        if (!formData.health_conditions || !formData.insurance_needs || !formData.risk) {
            return '请完整填写所有问卷字段';
        }
        return null;
    }

    // 验证医疗问卷数据
    function validateMedicalFormData(formData) {
        if (formData.age < 0 || formData.age > 120) {
            return '年龄必须在0至120岁之间';
        }
        if (!formData.gender || !formData.symptoms || !formData.duration || !formData.medical_history) {
            return '请完整填写所有问卷字段';
        }
        return null;
    }

    // 格式化保险问卷数据
    function formatInsuranceFormData(formData) {
        return `<div class="form-data">
            <div><strong>您的保险问卷信息</strong></div>
            <div>年龄：${formData.age || '未填写'}岁</div>
            <div>年收入：${formData.income || '未填写'}元</div>
            <div>健康状况：${formData.health_conditions || '未填写'}</div>
            <div>保险需求：${formData.insurance_needs || '未填写'}</div>
            <div>风险承受能力：${formData.risk || '未填写'}</div>
        </div>`;
    }

    // 格式化医疗问卷数据
    function formatMedicalFormData(formData) {
        return `<div class="form-data">
            <div><strong>您的医疗问卷信息</strong></div>
            <div>年龄：${formData.age || '未填写'}岁</div>
            <div>性别：${formData.gender || '未填写'}</div>
            <div>主要症状：${formData.symptoms || '未填写'}</div>
            <div>症状持续时间：${formData.duration || '未填写'}</div>
            <div>既往病史：${formData.medical_history || '未填写'}</div>
        </div>`;
    }

    // 提交保险问卷
    insuranceFormContent.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!isBackendHealthy) {
            showError('后端服务不可用，请检查网络连接或联系管理员。');
            appendMessage('assistant', `<div class="assistant-message ${currentExpert}">后端服务不可用，请检查网络连接或联系管理员。</div>`);
            return;
        }
        if (!insuranceFormContent) {
            showError('无法提交保险问卷，请检查页面配置。');
            appendMessage('assistant', `<div class="assistant-message ${currentExpert}">错误：无法提交保险问卷，请检查页面配置。</div>`);
            return;
        }
        const formData = {
            age: parseInt(document.getElementById('form-age')?.value) || 0,
            income: parseFloat(document.getElementById('form-income')?.value) || 0,
            health_conditions: document.getElementById('form-health')?.value || '',
            insurance_needs: document.getElementById('form-needs')?.value || '',
            risk: document.getElementById('form-risk')?.value || ''
        };

        const validationError = validateInsuranceFormData(formData);
        if (validationError) {
            showError(validationError);
            appendMessage('assistant', `<div class="assistant-message ${currentExpert}">错误：${validationError}</div>`);
            return;
        }

        const placeholder = chatBox.querySelector('.placeholder');
        if (placeholder) placeholder.style.display = 'none';

        const displayText = formatInsuranceFormData(formData);
        appendMessage('user', displayText);
        toggleInteractionButtons(false, true);

        try {
            console.log('提交保险问卷，专家类型:', currentExpert); // 调试：确认专家类型
            const response = await callBackendApi('保险问卷提交', currentExpert, currentSessionId, formData);
            appendMessage('assistant', `<div class="assistant-message ${currentExpert}">${marked.parse(response.response)}</div>`);
            saveChatHistory(displayText, response.response, currentExpert, formData);
            updateSessionList();
            gsap.to('#insurance-form', { 
                opacity: 0, 
                scale: 0.95, 
                duration: 0.3, 
                ease: 'power2.in', 
                onComplete: () => {
                    insuranceForm.style.display = 'none';
                    insuranceForm.classList.remove('show');
                    insuranceFormContent.reset();
                    insuranceForm.style.opacity = '1';
                    userInput.focus(); // 新增：焦点返回输入框
                } 
            });
            formSubmitted = true;
        } catch (error) {
            const errorMsg = error.message.includes('aborted') 
                ? '问卷提交超时，可能网络不稳定，请检查连接。'
                : error.message.includes('401') || error.message.includes('403') 
                ? 'API密钥无效，请检查或从 https://console.x.ai 获取新密钥。'
                : error.message;
            showError(errorMsg);
            appendMessage('assistant', `<div class="assistant-message ${currentExpert}">错误：${errorMsg}。请稍后重试。</div>`);
            console.error('问卷提交失败:', error);
            gsap.to('#insurance-form', { 
                opacity: 0, 
                scale: 0.95, 
                duration: 0.3, 
                ease: 'power2.in', 
                onComplete: () => {
                    insuranceForm.style.display = 'none';
                    insuranceForm.classList.remove('show');
                    insuranceFormContent.reset();
                    insuranceForm.style.opacity = '1';
                    userInput.focus(); // 新增：焦点返回输入框
                } 
            });
        } finally {
            toggleInteractionButtons(true, false);
        }
    });

    // 提交医疗问卷
    medicalFormContent.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!isBackendHealthy) {
            showError('后端服务不可用，请检查网络连接或联系管理员。');
            appendMessage('assistant', `<div class="assistant-message ${currentExpert}">后端服务不可用，请检查网络连接或联系管理员。</div>`);
            return;
        }
        if (!medicalFormContent) {
            showError('无法提交医疗问卷，请检查页面配置。');
            appendMessage('assistant', `<div class="assistant-message ${currentExpert}">错误：无法提交医疗问卷，请检查页面配置。</div>`);
            return;
        }
        const formData = {
            age: parseInt(document.getElementById('medical-form-age')?.value) || 0,
            gender: document.getElementById('medical-form-gender')?.value || '',
            symptoms: document.getElementById('medical-form-symptoms')?.value || '',
            duration: document.getElementById('medical-form-duration')?.value || '',
            medical_history: document.getElementById('medical-form-history')?.value || ''
        };

        const validationError = validateMedicalFormData(formData);
        if (validationError) {
            showError(validationError);
            appendMessage('assistant', `<div class="assistant-message ${currentExpert}">错误：${validationError}</div>`);
            return;
        }

        const placeholder = chatBox.querySelector('.placeholder');
        if (placeholder) placeholder.style.display = 'none';

        const displayText = formatMedicalFormData(formData);
        appendMessage('user', displayText);
        toggleInteractionButtons(false, true);

        try {
            console.log('提交医疗问卷，专家类型:', currentExpert); // 调试：确认专家类型
            const response = await callBackendApi('医疗问卷提交', currentExpert, currentSessionId, formData);
            appendMessage('assistant', `<div class="assistant-message ${currentExpert}">${marked.parse(response.response)}</div>`);
            saveChatHistory(displayText, response.response, currentExpert, formData);
            updateSessionList();
            gsap.to('#medical-form', { 
                opacity: 0, 
                scale: 0.95, 
                duration: 0.3, 
                ease: 'power2.in', 
                onComplete: () => {
                    medicalForm.style.display = 'none';
                    medicalForm.classList.remove('show');
                    medicalFormContent.reset();
                    medicalForm.style.opacity = '1';
                    userInput.focus(); // 新增：焦点返回输入框
                } 
            });
            formSubmitted = true;
        } catch (error) {
            const errorMsg = error.message.includes('aborted') 
                ? '问卷提交超时，可能网络不稳定，请检查连接。'
                : error.message.includes('401') || error.message.includes('403') 
                ? 'API密钥无效，请检查或从 https://console.x.ai 获取新密钥。'
                : error.message;
            showError(errorMsg);
            appendMessage('assistant', `<div class="assistant-message ${currentExpert}">错误：${errorMsg}。请稍后重试。</div>`);
            console.error('问卷提交失败:', error);
            gsap.to('#medical-form', { 
                opacity: 0, 
                scale: 0.95, 
                duration: 0.3, 
                ease: 'power2.in', 
                onComplete: () => {
                    medicalForm.style.display = 'none';
                    medicalForm.classList.remove('show');
                    medicalFormContent.reset();
                    medicalForm.style.opacity = '1';
                    userInput.focus(); // 新增：焦点返回输入框
                } 
            });
        } finally {
            toggleInteractionButtons(true, false);
        }
    });

    // 动态调整输入框高度
    userInput.addEventListener('input', () => {
        userInput.style.height = '40px';
        userInput.style.height = `${Math.min(userInput.scrollHeight, 100)}px`;
    });

    // 调用后端 API
    async function callBackendApi(userInput, expertType, sessionId, formData = null, retries = 3) {
        try {
            const history = getChatHistory(sessionId).map(msg => ({
                role: msg.role === 'ai' ? 'assistant' : msg.role,
                content: msg.content
            }));
            const controller = new AbortController();
            const timeoutId = setTimeout(() => {
                controller.abort(new Error('请求超时，可能网络不稳定'));
            }, 15000);
            console.log('API 请求:', { user_input: userInput, expert_type: expertType, session_id: sessionId }); // 调试：记录请求
            const response = await fetch(API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    user_input: userInput,
                    expert_type: expertType,
                    session_id: sessionId,
                    history,
                    form_data: formData
                }),
                signal: controller.signal
            });
            clearTimeout(timeoutId);
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || `HTTP错误！状态: ${response.status}`);
            }
            const data = await response.json();
            console.log('API 响应:', data); // 调试：记录响应
            if (data.status === 'error') throw new Error(data.error);
            return data;
        } catch (error) {
            if (retries > 0 && error.name !== 'AbortError') {
                console.warn(`API调用失败，重试剩余${retries - 1}次:`, error);
                await new Promise(resolve => setTimeout(resolve, 2000));
                return callBackendApi(userInput, expertType, sessionId, formData, retries - 1);
            }
            throw error;
        }
    }

    // 添加消息
    function appendMessage(role, content) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${role} ${role === 'assistant' ? currentExpert : ''}`;
        messageDiv.innerHTML = role === 'assistant' ? marked.parse(content) : content;
        chatBox.appendChild(messageDiv);
        if (chatBox.dataset.autoScroll === 'true') {
            setTimeout(() => {
                messageDiv.scrollIntoView({ behavior: 'smooth', block: 'end' });
                chatBox.scrollTop = chatBox.scrollHeight;
            }, 100);
        }
        gsap.from(messageDiv, { opacity: 0, y: 10, duration: 0.3, ease: 'power2.out' });
    }

    // 保存聊天历史
    function saveChatHistory(userInput, response, expertType, formData = null) {
        let chatHistory = JSON.parse(localStorage.getItem('chatHistory') || '[]');
        if (chatHistory.length >= MAX_SESSIONS) {
            chatHistory.shift();
        }
        if (!currentSessionId) {
            currentSessionId = Date.now().toString();
        }
        const session = chatHistory.find(s => s.sessionId === currentSessionId);
        if (session) {
            session.history.push(
                { role: 'user', content: userInput, formData },
                { role: 'assistant', content: response }
            );
        } else {
            chatHistory.push({
                sessionId: currentSessionId,
                expert: expertType,
                history: [
                    { role: 'user', content: userInput, formData },
                    { role: 'assistant', content: response }
                ],
                timestamp: new Date().toLocaleString('zh-CN')
            });
        }
        localStorage.setItem('chatHistory', JSON.stringify(chatHistory));
    }

    // 获取聊天历史
    function getChatHistory(sessionId) {
        const chatHistory = JSON.parse(localStorage.getItem('chatHistory') || '[]');
        const session = chatHistory.find(s => s.sessionId === sessionId);
        return session ? session.history : [];
    }

    // 删除会话
    function deleteSession(sessionId) {
        let chatHistory = JSON.parse(localStorage.getItem('chatHistory') || '[]');
        chatHistory = chatHistory.filter(s => s.sessionId !== sessionId);
        localStorage.setItem('chatHistory', JSON.stringify(chatHistory));
        if (sessionId === currentSessionId) {
            startNewSession();
        }
        updateSessionList();
    }

    // 更新会话列表
    function updateSessionList() {
        if (!sessionList) {
            showError('会话列表未找到，请检查页面配置。');
            return;
        }
        const chatHistory = JSON.parse(localStorage.getItem('chatHistory') || '[]');
        sessionList.innerHTML = '';
        chatHistory.forEach((session, index) => {
            const li = document.createElement('li');
            const icon = session.expert === 'medical'
                ? '<img src="/images/medical-icon.png" alt="医疗问诊专家" width="20" height="20">'
                : '<img src="/images/insurance-icon.png" alt="保险资产配置专家" width="20" height="20">';
            const preview = marked.parse(session.history[0]?.content || '').replace(/<\/?[^>]+(>|$)/g, '').substring(0, 20) + (session.history[0]?.content.length > 20 ? '...' : '');
            li.innerHTML = `
                ${icon} 会话 ${index + 1}: ${session.expert === 'medical' ? '医疗问诊' : '保险资产配置'} - ${session.timestamp}
                <br><small>${preview}</small>
                <button class="delete-session-btn" data-session-id="${session.sessionId}">删除</button>
            `;
            li.className = session.sessionId === currentSessionId ? 'selected' : '';
            li.addEventListener('click', (e) => {
                if (!e.target.classList.contains('delete-session-btn')) {
                    loadSession(session.sessionId);
                }
            });
            const deleteBtn = li.querySelector('.delete-session-btn');
            if (deleteBtn) {
                deleteBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    deleteSession(session.sessionId);
                });
            }
            sessionList.appendChild(li);
            gsap.from(li, { opacity: 0, x: -10, duration: 0.3, delay: index * 0.03, ease: 'power2.out' });
        });
        updateSessionListScroll();
    }

    // 更新会话列表滚动
    function updateSessionListScroll() {
        if (!sessionList) return;
        sessionList.style.overflowY = 'auto';
        if (sessionList.scrollHeight > sessionList.clientHeight) {
            sessionList.scrollTo({ top: sessionList.scrollHeight, behavior: 'smooth' });
        }
    }

    // 加载会话
    function loadSession(sessionId) {
        currentSessionId = sessionId;
        const chatHistory = JSON.parse(localStorage.getItem('chatHistory') || '[]');
        const session = chatHistory.find(s => s.sessionId === sessionId);
        if (session) {
            currentExpert = session.expert;
            localStorage.setItem('currentExpert', currentExpert);
            expertSelect.value = currentExpert;
            console.log('加载会话，专家类型:', currentExpert); // 调试：确认加载的专家类型
            updateExpertTitle();
            updateFormButtonVisibility();
            chatBox.innerHTML = '';
            session.history.forEach(msg => {
                appendMessage(msg.role, msg.role === 'assistant' ? marked.parse(msg.content) : msg.content);
            });
            formSubmitted = session.history.some(msg => msg.content.includes('提交问卷'));
            setTimeout(() => {
                chatBox.scrollTop = chatBox.scrollHeight;
                const lastMessage = chatBox.lastElementChild;
                if (lastMessage) {
                    lastMessage.scrollIntoView({ behavior: 'smooth', block: 'end' });
                }
            }, 100);
        }
        updateSessionList();
    }

    // 开始新会话
    function startNewSession() {
        currentSessionId = null;
        chatBox.innerHTML = '<div class="placeholder">欢迎开始咨询！请输入您的问题，或点击下方按钮填写问卷。</div>';
        userInput.value = '';
        userInput.style.height = '40px';
        insuranceForm.style.display = 'none';
        insuranceForm.classList.remove('show');
        medicalForm.style.display = 'none';
        medicalForm.classList.remove('show');
        insuranceFormContent.reset();
        medicalFormContent.reset();
        updateSessionList();
        gsap.from('.placeholder', { opacity: 0, y: 10, duration: 0.3, ease: 'power2.out' });
    }

    // 检查后端健康状态
    async function checkBackendHealth() {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => {
                controller.abort(new Error('健康检查超时，可能网络不稳定'));
            }, 10000);
            const response = await fetch('http://localhost:8000/health', { signal: controller.signal });
            clearTimeout(timeoutId);
            if (!response.ok) throw new Error(`健康检查失败，状态: ${response.status}`);
            const data = await response.json();
            isBackendHealthy = data.status === 'healthy';
            console.log('后端状态:', data.status);
            if (!isBackendHealthy) {
                showError('后端服务不可用，请检查网络连接或联系管理员。');
                appendMessage('assistant', `<div class="assistant-message ${currentExpert}">后端服务不可用：${data.error}。请检查网络连接或联系管理员。</div>`);
                toggleInteractionButtons(false, false);
            } else {
                toggleInteractionButtons(true, false);
            }
        } catch (error) {
            isBackendHealthy = false;
            console.error('后端健康检查失败:', error);
            showError('无法连接到后端服务器，请检查网络连接或联系管理员。');
            appendMessage('assistant', `<div class="assistant-message ${currentExpert}">无法连接到后端服务器：${error.message}。请检查网络连接或联系管理员。</div>`);
            toggleInteractionButtons(false, false);
        }
        setTimeout(checkBackendHealth, 30000);
    }

    // 切换交互按钮状态
    function toggleInteractionButtons(enabled, isLoading = false) {
        [sendBtn, insuranceFormBtn, medicalFormBtn, fileUpload].forEach(btn => {
            if (btn) {
                btn.disabled = !enabled;
                btn.style.opacity = enabled ? '1' : '0.5';
                btn.style.cursor = enabled ? 'pointer' : 'not-allowed';
                btn.classList.toggle('loading', isLoading);
                if (btn === sendBtn) {
                    btn.innerHTML = isLoading 
                        ? '<i class="fas fa-spinner fa-spin"></i> 发送中...' 
                        : '<i class="fas fa-paper-plane"></i> 发送';
                }
            }
        });
    }

    // 窗口大小变化时调整布局
    window.addEventListener('resize', () => {
        adjustChatBoxHeight();
        updateSessionListScroll();
    });

    // 初始化
    init();
});