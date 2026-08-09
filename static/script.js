// List of available JSON files (In a real app, this would come from a backend API)
const DATA_SOURCES = [
    'data/data.json',
    'data/data2.json'
];

let currentData = null; // Store current loaded data

document.addEventListener('DOMContentLoaded', () => {
    setupEventListeners();
    refreshProfileList(true); // Load sidebar and select first profile
});

function setupEventListeners() {
    // Print
    document.getElementById('print-btn')?.addEventListener('click', () => window.print());

    // Navigation
    document.getElementById('btn-show-resume')?.addEventListener('click', () => switchView('resume'));
    document.getElementById('btn-show-admin')?.addEventListener('click', () => {
        if (currentData) buildAdminForm(currentData);
        switchView('admin');
    });

    // Admin Actions
    document.getElementById('btn-new-profile')?.addEventListener('click', handleNewProfile);
    document.getElementById('btn-duplicate-profile')?.addEventListener('click', handleDuplicateProfile);
    document.getElementById('btn-save-preview')?.addEventListener('click', handleSavePreview);
    document.getElementById('btn-delete-profile')?.addEventListener('click', handleDeleteProfile);
    document.getElementById('btn-download-json')?.addEventListener('click', downloadJSON);

    // Sidebar Toggle Logic
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebar-overlay');
    const toggleBtn = document.getElementById('sidebar-toggle');

    if (toggleBtn && sidebar && overlay) {
        toggleBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            sidebar.classList.toggle('-translate-x-full');
            overlay.classList.toggle('hidden');
        });

        // Close when clicking overlay
        overlay.addEventListener('click', () => {
            sidebar.classList.add('-translate-x-full');
            overlay.classList.add('hidden');
        });
    }

    // Modal Listeners
    const deleteModal = document.getElementById('delete-modal');
    document.getElementById('btn-cancel-delete')?.addEventListener('click', () => {
        deleteModal.classList.add('hidden');
    });
    document.getElementById('btn-confirm-delete')?.addEventListener('click', confirmDeleteProfile);
}

function switchView(viewName) {
    const resumeView = document.getElementById('resume-view');
    const adminView = document.getElementById('admin-view');
    
    if (viewName === 'resume') {
        resumeView.classList.remove('hidden');
        adminView.classList.add('hidden');
    } else {
        resumeView.classList.add('hidden');
        adminView.classList.remove('hidden');
    }
}

function refreshProfileList(loadFirst = false) {
    const listContainer = document.getElementById('profile-list');
    listContainer.innerHTML = ''; // Clear

    // Get Local Profiles
    const localProfiles = getLocalProfiles().map(p => ({ ...p, _source: 'local' }));

    // Fetch File Profiles
    Promise.all(DATA_SOURCES.map(url => 
        fetch(url)
            .then(res => res.json())
            .then(data => ({ ...data, _source: 'file', _url: url }))
            .catch(err => { console.error(`Failed to load ${url}`, err); return null; })
    ))
    .then(fileProfiles => {
        // Filter out failed fetches and combine with local
        const allProfiles = [...fileProfiles.filter(p => p !== null), ...localProfiles];

        // Sort by First Name
        allProfiles.sort((a, b) => (a.header?.name || '').localeCompare(b.header?.name || ''));

        allProfiles.forEach((profile) => {
            const name = profile.header?.name || 'Untitled Profile';
            const initials = getInitials(name);
            const hue = stringToHue(name);
            const gradient = `linear-gradient(135deg, hsl(${hue}, 70%, 60%), hsl(${(hue + 40) % 360}, 70%, 40%))`;
            
            const li = document.createElement('li');
            li.className = `profile-item flex items-center px-4 py-3 border-l-4 border-transparent`;
            li.innerHTML = `
                <div class="profile-avatar w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white mr-3 shadow-sm" style="background: ${gradient}">
                    ${initials}
                </div>
                <span class="text-sm font-medium truncate">${name}</span>
            `;
            
            li.addEventListener('click', () => {
                // UI Active State
                updateSidebarActiveState(li);
                loadProfile(profile);
                switchView('resume');
            });

            // Highlight if matches currentData
            if (currentData && 
               ((profile._source === 'local' && profile.id === currentData.id) || 
                (profile._source === 'file' && profile._url === currentData._url))) {
                li.classList.add('active', 'border-blue-500');
                li.classList.remove('border-transparent');
            }
            
            listContainer.appendChild(li);
        });

        // Load first profile if requested and none loaded
        if (loadFirst && allProfiles.length > 0 && !currentData) {
            const firstItem = listContainer.firstElementChild;
            if (firstItem) {
                updateSidebarActiveState(firstItem);
                loadProfile(allProfiles[0]);
            }
        }
    })
    .catch(err => console.error('Error loading sidebar profiles:', err));
}

function updateSidebarActiveState(activeElement) {
    document.querySelectorAll('.profile-item').forEach(el => {
        el.classList.remove('active', 'border-blue-500');
        el.classList.add('border-transparent');
    });
    activeElement.classList.add('active', 'border-blue-500');
    activeElement.classList.remove('border-transparent');
}

function getLocalProfiles() {
    try {
        return JSON.parse(localStorage.getItem('resume_profiles') || '[]');
    } catch (e) {
        console.error("Error parsing local profiles", e);
        return [];
    }
}

function saveLocalProfile(profile) {
    const profiles = getLocalProfiles();
    const index = profiles.findIndex(p => p.id === profile.id);
    
    if (index >= 0) {
        profiles[index] = profile;
    } else {
        profiles.push(profile);
    }
    
    localStorage.setItem('resume_profiles', JSON.stringify(profiles));
}

function getInitials(name) {
    const parts = name.trim().split(/\s+/);
    if (parts.length === 0) return '';
    if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
    // First letter of first name + First letter of last name
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function loadProfile(data) {
    currentData = data;
    renderResume(data);
}

function renderResume(data) {
    document.title = `ResuManager | ${data.header.name}`;
    updateFavicon(data.header.name);
    renderHeader(data.header);
    renderSummary(data.summary);
    renderEducation(data.education);
    renderExperience(data.experience);
    renderProjects(data.projects);
    renderSkills(data.skills);
    renderAchievements(data.achievements);
}

function renderHeader(data) {
    const container = document.getElementById('header-section');
    
    const contactHtml = data.contact.map((item, index) => {
        let html = '';
        if (item.link) {
            html = `<a href="${item.link}">${item.text}</a>`;
        } else {
            html = `<span>${item.text}</span>`;
        }
        // Add separator if not the last item
        if (index < data.contact.length - 1) {
            html += `<span>|</span>`;
        }
        return html;
    }).join('\n');

    container.innerHTML = `
        <h1 class="text-3xl font-bold uppercase">${data.name}</h1>
        <div class="text-[0.82rem] flex justify-center flex-wrap gap-x-3 font-medium">
            ${contactHtml}
        </div>
        <div class="text-[0.82rem] italic mt-0.5 text-gray-700">${data.location}</div>
    `;
}

function renderSummary(data) {
    const container = document.getElementById('summary-section');
    container.innerHTML = `
        <h2>Summary</h2>
        <p class="text-[0.82rem] text-justify">${data}</p>
    `;
}

function renderEducation(data) {
    const container = document.getElementById('education-section');
    const itemsHtml = data.map(edu => `
        <div class="${data.indexOf(edu) !== data.length - 1 ? 'mb-2' : ''}">
            <div class="item-header">
                <span>${edu.institution}</span>
                <span>${edu.period}</span>
            </div>
            <div class="item-sub">
                <span>${edu.degree}</span>
                <span>${edu.score}</span>
            </div>
        </div>
    `).join('');
    
    container.innerHTML = `<h2>Education</h2>${itemsHtml}`;
}

function renderExperience(data) {
    const container = document.getElementById('experience-section');
    const itemsHtml = data.map(exp => `
        <div class="experience-item mb-2">
            <div class="item-header">
                <span>${exp.role}</span>
                <span>${exp.period}</span>
            </div>
            <ul>
                ${exp.details.map(detail => `<li>${detail}</li>`).join('')}
            </ul>
        </div>
    `).join('');

    container.innerHTML = `<h2>Work Experience</h2>${itemsHtml}`;
}

function renderProjects(data) {
    const container = document.getElementById('projects-section');
    const itemsHtml = data.map(proj => `
        <div class="mb-2">
            <div class="item-header ${data.indexOf(proj) === data.length - 1 ? 'mb-0' : ''}">
                <span>${proj.title} <br/><span class="font-normal italic">${proj.tech}</span></span>
                <span>${proj.year}</span>
            </div>
            <ul>
                ${proj.details.map(detail => `<li>${detail}</li>`).join('')}
            </ul>
        </div>
    `).join('');

    container.innerHTML = `<h2>Selected Projects</h2>${itemsHtml}`;
}

function renderSkills(data) {
    const container = document.getElementById('skills-section');
    const itemsHtml = data.map(skill => `
        <span class="bold">${skill.category}:</span> <span>${skill.items}</span>
    `).join('\n');

    container.innerHTML = `
        <h2>Technical Skills</h2>
        <div class="skills-grid">${itemsHtml}</div>
    `;
}

function renderAchievements(data) {
    const container = document.getElementById('achievements-section');
    const itemsHtml = data.map(item => `<li><strong>${item.label}:</strong> ${item.description}</li>`).join('');
    container.innerHTML = `<h2>Achievements & Leadership</h2><ul>${itemsHtml}</ul>`;
}

// --- ADMIN FUNCTIONS ---

function buildAdminForm(data) {
    const form = document.getElementById('admin-form');
    form.innerHTML = ''; // Clear

    // Toggle Delete Button visibility based on source
    const deleteBtn = document.getElementById('btn-delete-profile');
    if (deleteBtn) {
        if (data._source === 'local') {
            deleteBtn.classList.remove('hidden');
        } else {
            deleteBtn.classList.add('hidden');
        }
    }

    // 1. Header
    form.appendChild(createSectionTitle('Header Information'));
    const headerSet = createFieldset('header-group');
    headerSet.appendChild(createInput('Full Name', data.header.name || '', 'header-name'));
    headerSet.appendChild(createInput('Location', data.header.location || '', 'header-location'));
    
    // Contact (Array)
    const contactContainer = document.createElement('div');
    contactContainer.className = 'mt-4';
    contactContainer.innerHTML = '<label class="block text-sm font-bold text-gray-700 mb-2">Contact Links</label>';
    const contactList = document.createElement('div');
    contactList.id = 'contact-list';
    (data.header.contact || []).forEach(c => contactList.appendChild(createContactItem(c)));
    contactContainer.appendChild(contactList);
    contactContainer.appendChild(createAddButton('Add Contact', () => contactList.appendChild(createContactItem({}))));
    headerSet.appendChild(contactContainer);
    form.appendChild(headerSet);

    // 2. Summary
    form.appendChild(createSectionTitle('Professional Summary'));
    const summarySet = createFieldset('summary-group');
    const summaryArea = document.createElement('textarea');
    summaryArea.className = 'w-full p-2 border rounded shadow-sm focus:ring-blue-500 focus:border-blue-500';
    summaryArea.rows = 4;
    summaryArea.id = 'input-summary';
    summaryArea.value = data.summary || '';
    summarySet.appendChild(summaryArea);
    form.appendChild(summarySet);

    // 3. Education
    form.appendChild(createSectionTitle('Education'));
    const eduContainer = document.createElement('div');
    eduContainer.id = 'education-list';
    (data.education || []).forEach(edu => eduContainer.appendChild(createEducationItem(edu)));
    form.appendChild(eduContainer);
    form.appendChild(createAddButton('Add Education', () => eduContainer.appendChild(createEducationItem({}))));

    // 4. Experience
    form.appendChild(createSectionTitle('Work Experience'));
    const expContainer = document.createElement('div');
    expContainer.id = 'experience-list';
    (data.experience || []).forEach(exp => expContainer.appendChild(createExperienceItem(exp)));
    form.appendChild(expContainer);
    form.appendChild(createAddButton('Add Experience', () => expContainer.appendChild(createExperienceItem({}))));

    // 5. Projects
    form.appendChild(createSectionTitle('Projects'));
    const projContainer = document.createElement('div');
    projContainer.id = 'projects-list';
    (data.projects || []).forEach(proj => projContainer.appendChild(createProjectItem(proj)));
    form.appendChild(projContainer);
    form.appendChild(createAddButton('Add Project', () => projContainer.appendChild(createProjectItem({}))));

    // 6. Skills
    form.appendChild(createSectionTitle('Skills'));
    const skillsContainer = document.createElement('div');
    skillsContainer.id = 'skills-list';
    (data.skills || []).forEach(s => skillsContainer.appendChild(createSkillItem(s)));
    form.appendChild(skillsContainer);
    form.appendChild(createAddButton('Add Skill Category', () => skillsContainer.appendChild(createSkillItem({}))));

    // 7. Achievements
    form.appendChild(createSectionTitle('Achievements'));
    const achieveContainer = document.createElement('div');
    achieveContainer.id = 'achievements-list';
    (data.achievements || []).forEach(a => achieveContainer.appendChild(createAchievementItem(a)));
    form.appendChild(achieveContainer);
    form.appendChild(createAddButton('Add Achievement', () => achieveContainer.appendChild(createAchievementItem({}))));
}

// --- FORM BUILDER HELPERS ---

function createSectionTitle(text) {
    const h3 = document.createElement('h3');
    h3.className = 'text-xl font-bold text-gray-800 mt-8 mb-4 border-b pb-2';
    h3.textContent = text;
    return h3;
}

function createFieldset(className) {
    const div = document.createElement('div');
    div.className = `bg-gray-50 p-4 rounded border border-gray-200 ${className}`;
    return div;
}

function createInput(label, value, name, placeholder = '') {
    const div = document.createElement('div');
    div.className = 'mb-3';
    div.innerHTML = `<label class="block text-sm font-medium text-gray-700 mb-1">${label}</label>`;
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'w-full p-2 border rounded shadow-sm focus:ring-blue-500 focus:border-blue-500';
    input.value = value || '';
    input.name = name; // Used for identification if needed
    input.placeholder = placeholder;
    div.appendChild(input);
    return div;
}

function createAddButton(text, onClick) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'mt-2 text-sm text-blue-600 hover:text-blue-800 font-semibold flex items-center';
    btn.innerHTML = `<i class="fa-solid fa-plus-circle mr-1"></i> ${text}`;
    btn.onclick = onClick;
    return btn;
}

function createRemoveButton(onClick) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'text-red-500 hover:text-red-700 ml-2';
    btn.innerHTML = '<i class="fa-solid fa-trash"></i>';
    btn.onclick = onClick;
    return btn;
}

// --- ITEM GENERATORS ---

function createContactItem(data) {
    const div = document.createElement('div');
    div.className = 'flex gap-2 mb-2 items-start contact-item';
    div.appendChild(createInput('Display Text', data.text, 'contact-text').firstChild.nextSibling); // Hack to get input only
    div.appendChild(createInput('Link (Optional)', data.link, 'contact-link').firstChild.nextSibling);
    div.appendChild(createRemoveButton(() => div.remove()));
    return div;
}

function createEducationItem(data) {
    const div = createFieldset('mb-4 education-item relative');
    div.innerHTML = '<div class="absolute top-2 right-2"></div>'; // Placeholder for remove btn
    div.querySelector('.absolute').appendChild(createRemoveButton(() => div.remove()));
    
    div.appendChild(createInput('Institution', data.institution, 'edu-inst'));
    div.appendChild(createInput('Period', data.period, 'edu-period'));
    div.appendChild(createInput('Degree', data.degree, 'edu-degree'));
    div.appendChild(createInput('Score', data.score, 'edu-score'));
    return div;
}

function createExperienceItem(data) {
    const div = createFieldset('mb-4 experience-item relative');
    div.innerHTML = '<div class="absolute top-2 right-2"></div>';
    div.querySelector('.absolute').appendChild(createRemoveButton(() => div.remove()));

    div.appendChild(createInput('Role', data.role, 'exp-role'));
    div.appendChild(createInput('Period', data.period, 'exp-period'));
    
    // Details List
    const detailsContainer = document.createElement('div');
    detailsContainer.className = 'mt-2 pl-4 border-l-2 border-gray-300';
    detailsContainer.innerHTML = '<label class="text-xs font-bold uppercase text-gray-500">Bullet Points</label>';
    const list = document.createElement('div');
    list.className = 'exp-details-list';
    (data.details || []).forEach(d => list.appendChild(createDetailItem(d)));
    detailsContainer.appendChild(list);
    detailsContainer.appendChild(createAddButton('Add Bullet Point', () => list.appendChild(createDetailItem(''))));
    
    div.appendChild(detailsContainer);
    return div;
}

function createProjectItem(data) {
    const div = createFieldset('mb-4 project-item relative');
    div.innerHTML = '<div class="absolute top-2 right-2"></div>';
    div.querySelector('.absolute').appendChild(createRemoveButton(() => div.remove()));

    div.appendChild(createInput('Title', data.title, 'proj-title'));
    div.appendChild(createInput('Tech Stack', data.tech, 'proj-tech'));
    div.appendChild(createInput('Year', data.year, 'proj-year'));

    // Details List
    const detailsContainer = document.createElement('div');
    detailsContainer.className = 'mt-2 pl-4 border-l-2 border-gray-300';
    detailsContainer.innerHTML = '<label class="text-xs font-bold uppercase text-gray-500">Bullet Points</label>';
    const list = document.createElement('div');
    list.className = 'proj-details-list';
    (data.details || []).forEach(d => list.appendChild(createDetailItem(d)));
    detailsContainer.appendChild(list);
    detailsContainer.appendChild(createAddButton('Add Bullet Point', () => list.appendChild(createDetailItem(''))));

    div.appendChild(detailsContainer);
    return div;
}

function createDetailItem(text) {
    const div = document.createElement('div');
    div.className = 'flex gap-2 mb-1 items-center detail-item';
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'w-full p-1 text-sm border rounded';
    input.value = text;
    div.appendChild(input);
    div.appendChild(createRemoveButton(() => div.remove()));
    return div;
}

function createSkillItem(data) {
    const div = createFieldset('mb-2 skill-item flex gap-4 items-end');
    const catDiv = createInput('Category', data.category, 'skill-cat');
    catDiv.className = 'flex-1';
    const itemsDiv = createInput('Items (comma separated)', data.items, 'skill-items');
    itemsDiv.className = 'flex-[2]';
    
    div.appendChild(catDiv);
    div.appendChild(itemsDiv);
    div.appendChild(createRemoveButton(() => div.remove()));
    return div;
}

function createAchievementItem(data) {
    const div = createFieldset('mb-2 achievement-item flex gap-4 items-end');
    
    const labelDiv = createInput('Label', data.label, 'achieve-label');
    labelDiv.className = 'flex-1';
    
    const descDiv = createInput('Description', data.description, 'achieve-desc');
    descDiv.className = 'flex-[2]';
    
    div.appendChild(labelDiv);
    div.appendChild(descDiv);
    div.appendChild(createRemoveButton(() => div.remove()));
    return div;
}

function handleNewProfile() {
    const emptyData = {
        id: Date.now().toString(), // Generate ID immediately
        _source: 'local',
        header: { name: "New Profile", location: "", contact: [] },
        summary: "",
        education: [],
        experience: [],
        projects: [],
        skills: [],
        achievements: []
    };
    
    currentData = emptyData;
    document.title = `ResuManager | ${emptyData.header.name}`;
    updateFavicon(emptyData.header.name);
    
    // Clear sidebar selection
    document.querySelectorAll('.profile-item').forEach(el => {
        el.classList.remove('active', 'border-blue-500');
        el.classList.add('border-transparent');
    });

    buildAdminForm(emptyData);
    switchView('admin');
}

function handleSavePreview() {
    const formData = getFormDataFromDOM();
    
    // Preserve ID and Source info
    if (currentData && currentData._source === 'local' && currentData.id) {
        formData.id = currentData.id;
    } else {
        // If saving a file-based profile or a fresh one, create new ID
        formData.id = Date.now().toString();
    }
    formData._source = 'local';

    saveLocalProfile(formData);
    currentData = formData;
    
    renderResume(formData);
    refreshProfileList(); // Refresh sidebar to show updated name/initials
    showToast("Profile saved to Local Storage!");
}

function handleDuplicateProfile() {
    if (!currentData) return;

    // Deep copy the current data
    const newData = JSON.parse(JSON.stringify(currentData));
    
    // Assign new ID and Source
    newData.id = Date.now().toString();
    newData._source = 'local';
    
    // Append (Copy) to name to distinguish
    newData.header.name = `${newData.header.name} (Copy)`;
    
    // Clean up file-specific properties if they exist
    delete newData._url;

    saveLocalProfile(newData);
    currentData = newData;
    
    refreshProfileList();
    renderResume(newData);
    buildAdminForm(newData);
    switchView('admin');
    
    showToast("Profile duplicated successfully!");
}

function handleDeleteProfile() {
    if (!currentData || currentData._source !== 'local') return;
    document.getElementById('delete-modal').classList.remove('hidden');
}

function confirmDeleteProfile() {
    const profiles = getLocalProfiles();
    const newProfiles = profiles.filter(p => p.id !== currentData.id);
    localStorage.setItem('resume_profiles', JSON.stringify(newProfiles));

    document.getElementById('delete-modal').classList.add('hidden');
    currentData = null;
    refreshProfileList(true); // Reload and select first available
    switchView('resume');
}

function showToast(message) {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = 'bg-gray-800 text-white px-6 py-3 rounded shadow-lg flex items-center gap-3 transform transition-all duration-300 translate-y-2 opacity-0 pointer-events-auto';
    toast.innerHTML = `<i class="fa-solid fa-circle-check text-green-400"></i> <span>${message}</span>`;
    
    container.appendChild(toast);
    requestAnimationFrame(() => toast.classList.remove('translate-y-2', 'opacity-0'));
    setTimeout(() => {
        toast.classList.add('opacity-0', 'translate-y-2');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

function getFormDataFromDOM() {
    // Scrape the DOM to rebuild the JSON object
    const getVal = (parent, selector) => parent.querySelector(selector)?.value || '';
    const getList = (parent, selector, mapFn) => Array.from(parent.querySelectorAll(selector)).map(mapFn);

    return {
        header: {
            name: document.querySelector('input[name="header-name"]').value,
            location: document.querySelector('input[name="header-location"]').value,
            contact: getList(document.getElementById('contact-list'), '.contact-item', el => ({
                text: el.querySelectorAll('input')[0].value,
                link: el.querySelectorAll('input')[1].value || null
            }))
        },
        summary: document.getElementById('input-summary').value,
        
        education: getList(document.getElementById('education-list'), '.education-item', el => ({
            institution: getVal(el, 'input[name="edu-inst"]'),
            period: getVal(el, 'input[name="edu-period"]'),
            degree: getVal(el, 'input[name="edu-degree"]'),
            score: getVal(el, 'input[name="edu-score"]')
        })),

        experience: getList(document.getElementById('experience-list'), '.experience-item', el => ({
            role: getVal(el, 'input[name="exp-role"]'),
            period: getVal(el, 'input[name="exp-period"]'),
            details: getList(el, '.exp-details-list .detail-item input', i => i.value)
        })),

        projects: getList(document.getElementById('projects-list'), '.project-item', el => ({
            title: getVal(el, 'input[name="proj-title"]'),
            tech: getVal(el, 'input[name="proj-tech"]'),
            year: getVal(el, 'input[name="proj-year"]'),
            details: getList(el, '.proj-details-list .detail-item input', i => i.value)
        })),

        skills: getList(document.getElementById('skills-list'), '.skill-item', el => ({
            category: getVal(el, 'input[name="skill-cat"]'),
            items: getVal(el, 'input[name="skill-items"]')
        })),

        achievements: getList(document.getElementById('achievements-list'), '.achievement-item', el => ({
            label: getVal(el, 'input[name="achieve-label"]'),
            description: getVal(el, 'input[name="achieve-desc"]')
        }))
    };
}

function downloadJSON() {
    const finalData = getFormDataFromDOM();
    
    // Create download link
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(finalData, null, 4));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", (finalData.header.name.replace(/\s+/g, '_') || "resume") + ".json");
    document.body.appendChild(downloadAnchorNode); // required for firefox
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
}

function updateFavicon(name) {
    const initials = getInitials(name);
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');

    const hue = stringToHue(name);

    // Background Gradient
    const gradient = ctx.createLinearGradient(0, 0, 64, 64);
    gradient.addColorStop(0, `hsl(${hue}, 70%, 60%)`);
    gradient.addColorStop(1, `hsl(${(hue + 40) % 360}, 70%, 40%)`);
    
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(32, 32, 32, 0, 2 * Math.PI);
    ctx.fill();

    // Text
    ctx.fillStyle = 'white';
    ctx.font = 'bold 26px Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(initials, 32, 34);

    const link = document.getElementById('dynamic-favicon');
    if (link) link.href = canvas.toDataURL();
}

function stringToHue(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    return Math.abs(hash % 360);
}