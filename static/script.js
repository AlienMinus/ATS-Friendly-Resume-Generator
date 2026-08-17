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
    document.getElementById('print-btn')?.addEventListener('click', openPdfModal);
    setupPdfModal();

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
    document.title = `ResuManager | ${data.header?.name || 'Resume'}`;
    updateFavicon(data.header?.name || 'Resume');

    // Backward-compatible defaults for profiles created before the new sections.
    data.skills = Array.isArray(data.skills) ? data.skills : [];
    data.certifications = Array.isArray(data.certifications) ? data.certifications : [];
    data.customSections = Array.isArray(data.customSections) ? data.customSections : [];

    renderHeader(data.header || { name: '', location: '', contact: [] });
    renderSummary(data.summary || '');
    renderEducation(data.education || []);
    renderSkills(data.skills);
    renderExperience(data.experience || []);
    renderProjects(data.projects || []);
    renderCertifications(data.certifications);
    renderAchievements(data.achievements || []);
    renderCustomSections(data.customSections);
}

function renderHeader(data) {
    const container = document.getElementById('header-section');
    const contact = Array.isArray(data.contact) ? data.contact : [];

    const contactHtml = contact.map((item, index) => {
        let html = item.link
            ? `<a href="${item.link}">${item.text || ''}</a>`
            : `<span>${item.text || ''}</span>`;

        if (index < contact.length - 1) html += `<span>|</span>`;
        return html;
    }).join('\n');

    container.innerHTML = `
        <h1 class="text-3xl font-bold uppercase">${data.name || ''}</h1>
        <div class="text-[0.82rem] flex justify-center flex-wrap gap-x-3 font-medium">
            ${contactHtml}
        </div>
        <div class="text-[0.82rem] italic mt-0.5 text-gray-700">${data.location || ''}</div>
    `;
}

function renderSummary(data) {
    const container = document.getElementById('summary-section');
    container.innerHTML = `
        <h2>Summary</h2>
        <p class="text-[0.82rem] text-justify">${data || ''}</p>
    `;
}

function renderPublicLink(link) {
    if (!link) return '';
    return ` <a class="public-view-link" href="${link}" target="_blank" rel="noopener noreferrer" aria-label="Open public link">LINK</a>`;
}

function renderEducation(data) {
    const container = document.getElementById('education-section');
    const itemsHtml = data.map((edu, index) => `
        <div class="${index !== data.length - 1 ? 'mb-2' : ''}">
            <div class="item-header">
                <span>${edu.institution || ''}</span>
                <span>${edu.period || ''}</span>
            </div>
            <div class="item-sub">
                <span>${edu.degree || ''}</span>
                <span>${edu.score || ''}</span>
            </div>
        </div>
    `).join('');

    container.innerHTML = `<h2>Education</h2>${itemsHtml}`;
}

function renderSkills(data) {
    const container = document.getElementById('skills-section');

    if (!data.length) {
        container.innerHTML = '';
        return;
    }

    const itemsHtml = data.map(skill => `
        <span class="bold">${skill.category || ''}:</span>
        <span>${skill.items || ''}</span>
    `).join('\n');

    container.innerHTML = `
        <h2>Technical Skills</h2>
        <div class="skills-grid">${itemsHtml}</div>
    `;
}

function renderExperience(data) {
    const container = document.getElementById('experience-section');
    const itemsHtml = data.map(exp => `
        <div class="experience-item mb-2">
            <div class="item-header">
                <span>${exp.role || ''}${renderPublicLink(exp.link)}</span>
                <span>${exp.period || ''}</span>
            </div>
            <ul>
                ${(Array.isArray(exp.details) ? exp.details : []).map(detail => `<li>${detail}</li>`).join('')}
            </ul>
        </div>
    `).join('');

    container.innerHTML = `<h2>Work Experience</h2>${itemsHtml}`;
}

function renderProjects(data) {
    const container = document.getElementById('projects-section');

    if (!data.length) {
        container.innerHTML = '';
        return;
    }

    const itemsHtml = data.map((proj, index) => `
        <div class="mb-2">
            <div class="item-header ${index === data.length - 1 ? 'mb-0' : ''}">
                <span>${proj.title || ''}${renderPublicLink(proj.link)} <br/><span class="font-normal italic">${proj.tech || ''}</span></span>
                <span>${proj.year || ''}</span>
            </div>
            <ul>
                ${(Array.isArray(proj.details) ? proj.details : []).map(detail => `<li>${detail}</li>`).join('')}
            </ul>
        </div>
    `).join('');

    container.innerHTML = `<h2>Top Projects</h2>${itemsHtml}`;
}

function renderCertifications(data) {
    const container = document.getElementById('certifications-section');

    if (!data.length) {
        container.innerHTML = '';
        return;
    }

    const itemsHtml = data.map(cert => `
        <li>
            <strong>${cert.name || ''}${renderPublicLink(cert.link)}</strong>${cert.issuer ? ` — ${cert.issuer}` : ''}
            ${cert.year ? ` (${cert.year})` : ''}
            ${cert.details ? `: ${cert.details}` : ''}
        </li>
    `).join('');

    container.innerHTML = `<h2>Certifications</h2><ul>${itemsHtml}</ul>`;
}

function renderAchievements(data) {
    const container = document.getElementById('achievements-section');

    if (!data.length) {
        container.innerHTML = '';
        return;
    }

    const itemsHtml = data.map(item =>
        `<li><strong>${item.label || ''}:</strong> ${item.description || ''}</li>`
    ).join('');

    container.innerHTML = `<h2>Achievements & Leadership</h2><ul>${itemsHtml}</ul>`;
}

function renderCustomSections(data) {
    const container = document.getElementById('custom-sections-container');
    if (!container) return;

    container.innerHTML = data
        .filter(section => section && (section.title || (section.items || []).length))
        .map(section => {
            const items = Array.isArray(section.items) ? section.items : [];
            return `
                <section class="custom-resume-section">
                    <h2>${section.title || 'Custom Section'}</h2>
                    ${items.length
                        ? `<ul>${items.map(item => `<li>${item}</li>`).join('')}</ul>`
                        : ''}
                </section>
            `;
        }).join('');
}

// --- ADMIN FUNCTIONS ---

function buildAdminForm(data) {
    const form = document.getElementById('admin-form');
    form.innerHTML = '';

    // The delete action is only available for profiles actually stored locally.
    const deleteBtn = document.getElementById('btn-delete-profile');
    if (deleteBtn) {
        deleteBtn.classList.toggle('hidden', data?._source !== 'local');
    }

    // 1. Header
    form.appendChild(createSectionTitle('Header Information'));
    const headerSet = createFieldset('header-group');
    headerSet.appendChild(createInput('Full Name', data.header?.name || '', 'header-name'));
    headerSet.appendChild(createInput('Location', data.header?.location || '', 'header-location'));

    const contactContainer = document.createElement('div');
    contactContainer.className = 'mt-4';
    contactContainer.innerHTML = '<label class="block text-sm font-bold text-gray-700 mb-2">Contact Links</label>';
    const contactList = document.createElement('div');
    contactList.id = 'contact-list';
    (data.header?.contact || []).forEach(c => contactList.appendChild(createContactItem(c)));
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

    // 4. Skills — deliberately before Work Experience.
    form.appendChild(createSectionTitle('Skills'));
    const skillsContainer = document.createElement('div');
    skillsContainer.id = 'skills-list';
    (data.skills || []).forEach(s => skillsContainer.appendChild(createSkillItem(s)));
    form.appendChild(skillsContainer);
    form.appendChild(createAddButton('Add Skill Category', () => skillsContainer.appendChild(createSkillItem({}))));

    // 5. Work Experience
    form.appendChild(createSectionTitle('Work Experience'));
    const expContainer = document.createElement('div');
    expContainer.id = 'experience-list';
    (data.experience || []).forEach(exp => expContainer.appendChild(createExperienceItem(exp)));
    form.appendChild(expContainer);
    form.appendChild(createAddButton('Add Experience', () => expContainer.appendChild(createExperienceItem({}))));

    // 6. Top Projects
    form.appendChild(createSectionTitle('Top Projects'));
    const projContainer = document.createElement('div');
    projContainer.id = 'projects-list';
    (data.projects || []).forEach(proj => projContainer.appendChild(createProjectItem(proj)));
    form.appendChild(projContainer);
    form.appendChild(createAddButton('Add Project', () => projContainer.appendChild(createProjectItem({}))));

    // 7. Certifications — before Achievements.
    form.appendChild(createSectionTitle('Certifications'));
    const certContainer = document.createElement('div');
    certContainer.id = 'certifications-list';
    (data.certifications || []).forEach(cert => certContainer.appendChild(createCertificationItem(cert)));
    form.appendChild(certContainer);
    form.appendChild(createAddButton('Add Certification', () => certContainer.appendChild(createCertificationItem({}))));

    // 8. Achievements
    form.appendChild(createSectionTitle('Achievements'));
    const achieveContainer = document.createElement('div');
    achieveContainer.id = 'achievements-list';
    (data.achievements || []).forEach(a => achieveContainer.appendChild(createAchievementItem(a)));
    form.appendChild(achieveContainer);
    form.appendChild(createAddButton('Add Achievement', () => achieveContainer.appendChild(createAchievementItem({}))));

    // 9. Custom Sections
    form.appendChild(createSectionTitle('Custom Sections'));
    const customContainer = document.createElement('div');
    customContainer.id = 'custom-sections-list';

    (data.customSections || []).forEach(section => {
        customContainer.appendChild(createCustomSectionItem(section));
    });

    form.appendChild(customContainer);
    form.appendChild(createAddButton('Add New Custom Section', () => {
        const section = createCustomSectionItem({ title: '', items: [] });
        customContainer.appendChild(section);
        section.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }));
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
    div.appendChild(createInput('Public View Link', data.link || '', 'exp-link', 'https://...'));
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
    div.appendChild(createInput('Public View Link', data.link || '', 'proj-link', 'https://...'));
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

function createCertificationItem(data) {
    const div = createFieldset('mb-4 certification-item relative');
    div.innerHTML = '<div class="absolute top-2 right-2"></div>';
    div.querySelector('.absolute').appendChild(createRemoveButton(() => div.remove()));

    div.appendChild(createInput('Certification Name', data.name || '', 'cert-name'));
    div.appendChild(createInput('Public View Link', data.link || '', 'cert-link', 'https://...'));
    div.appendChild(createInput('Issuing Organization', data.issuer || '', 'cert-issuer'));
    div.appendChild(createInput('Year', data.year || '', 'cert-year'));
    div.appendChild(createInput('Details (Optional)', data.details || '', 'cert-details'));

    return div;
}

function createCustomSectionItem(data) {
    const div = createFieldset('mb-4 custom-section-item relative');
    div.innerHTML = '<div class="absolute top-2 right-2"></div>';
    div.querySelector('.absolute').appendChild(createRemoveButton(() => div.remove()));

    div.appendChild(createInput(
        'Section Title',
        data.title || '',
        'custom-title',
        'e.g. Research Interests, Publications, Volunteer Experience'
    ));

    const itemsContainer = document.createElement('div');
    itemsContainer.className = 'mt-2 pl-4 border-l-2 border-gray-300';
    itemsContainer.innerHTML = '<label class="text-xs font-bold uppercase text-gray-500">Items</label>';

    const list = document.createElement('div');
    list.className = 'custom-items-list';

    (data.items || []).forEach(item => list.appendChild(createDetailItem(item)));

    itemsContainer.appendChild(list);
    itemsContainer.appendChild(
        createAddButton('Add Item', () => list.appendChild(createDetailItem('')))
    );

    div.appendChild(itemsContainer);
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
        certifications: [],
        achievements: [],
        customSections: []
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
    // Never call localStorage.clear(): other application data must remain untouched.
    if (!currentData || currentData._source !== 'local' || !currentData.id) {
        document.getElementById('delete-modal')?.classList.add('hidden');
        return;
    }

    const profiles = getLocalProfiles();
    const exists = profiles.some(profile => String(profile.id) === String(currentData.id));

    if (exists) {
        const newProfiles = profiles.filter(
            profile => String(profile.id) !== String(currentData.id)
        );

        // Keep the storage key intact even when this was the last profile.
        localStorage.setItem('resume_profiles', JSON.stringify(newProfiles));
        showToast('Profile deleted. Other local data was preserved.');
    }

    document.getElementById('delete-modal')?.classList.add('hidden');
    currentData = null;
    refreshProfileList(true);
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
    // Scrape the DOM to rebuild the JSON object.
    const getVal = (parent, selector) => parent.querySelector(selector)?.value || '';
    const getList = (parent, selector, mapFn) =>
        parent ? Array.from(parent.querySelectorAll(selector)).map(mapFn) : [];

    return {
        header: {
            name: document.querySelector('input[name="header-name"]')?.value || '',
            location: document.querySelector('input[name="header-location"]')?.value || '',
            contact: getList(document.getElementById('contact-list'), '.contact-item', el => ({
                text: el.querySelectorAll('input')[0]?.value || '',
                link: el.querySelectorAll('input')[1]?.value || null
            }))
        },

        summary: document.getElementById('input-summary')?.value || '',

        education: getList(document.getElementById('education-list'), '.education-item', el => ({
            institution: getVal(el, 'input[name="edu-inst"]'),
            period: getVal(el, 'input[name="edu-period"]'),
            degree: getVal(el, 'input[name="edu-degree"]'),
            score: getVal(el, 'input[name="edu-score"]')
        })),

        // Skills intentionally precede experience in the saved data as well.
        skills: getList(document.getElementById('skills-list'), '.skill-item', el => ({
            category: getVal(el, 'input[name="skill-cat"]'),
            items: getVal(el, 'input[name="skill-items"]')
        })),

        experience: getList(document.getElementById('experience-list'), '.experience-item', el => ({
            role: getVal(el, 'input[name="exp-role"]'),
            link: getVal(el, 'input[name="exp-link"]'),
            period: getVal(el, 'input[name="exp-period"]'),
            details: getList(el, '.exp-details-list .detail-item input', i => i.value)
        })),

        projects: getList(document.getElementById('projects-list'), '.project-item', el => ({
            title: getVal(el, 'input[name="proj-title"]'),
            link: getVal(el, 'input[name="proj-link"]'),
            tech: getVal(el, 'input[name="proj-tech"]'),
            year: getVal(el, 'input[name="proj-year"]'),
            details: getList(el, '.proj-details-list .detail-item input', i => i.value)
        })),

        certifications: getList(
            document.getElementById('certifications-list'),
            '.certification-item',
            el => ({
                name: getVal(el, 'input[name="cert-name"]'),
                link: getVal(el, 'input[name="cert-link"]'),
                issuer: getVal(el, 'input[name="cert-issuer"]'),
                year: getVal(el, 'input[name="cert-year"]'),
                details: getVal(el, 'input[name="cert-details"]')
            })
        ),

        achievements: getList(document.getElementById('achievements-list'), '.achievement-item', el => ({
            label: getVal(el, 'input[name="achieve-label"]'),
            description: getVal(el, 'input[name="achieve-desc"]')
        })),

        customSections: getList(
            document.getElementById('custom-sections-list'),
            '.custom-section-item',
            el => ({
                title: getVal(el, 'input[name="custom-title"]'),
                items: getList(el, '.custom-items-list .detail-item input', i => i.value)
            })
        )
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


// =========================================================
// PDF DOWNLOAD / PREVIEW
// =========================================================
let pdfState = { blob: null, url: null, rendering: false };

function setupPdfModal() {
    const modal = document.getElementById('pdf-modal');
    if (!modal) return;

    const controls = ['pdf-scale', 'pdf-page-size', 'pdf-margin-top', 'pdf-margin-right', 'pdf-margin-bottom', 'pdf-margin-left', 'pdf-break-mode'];
    controls.forEach(id => {
        const el = document.getElementById(id);
        el?.addEventListener('input', () => {
            if (id === 'pdf-scale') document.getElementById('pdf-scale-value').textContent = `${el.value}%`;
            schedulePdfRender();
        });
        el?.addEventListener('change', schedulePdfRender);
    });

    document.getElementById('pdf-reset')?.addEventListener('click', () => {
        document.getElementById('pdf-scale').value = 100;
        document.getElementById('pdf-scale-value').textContent = '100%';
        document.getElementById('pdf-page-size').value = 'a4';
        document.getElementById('pdf-margin-top').value = 7;
        document.getElementById('pdf-margin-right').value = 10;
        document.getElementById('pdf-margin-bottom').value = 7;
        document.getElementById('pdf-margin-left').value = 10;
        document.getElementById('pdf-break-mode').value = 'auto';
        document.querySelectorAll('.pdf-break-section').forEach(el => { el.checked = false; });
        document.getElementById('pdf-custom-breaks')?.classList.add('hidden');
        renderPdfPreview();
    });

    ['pdf-close', 'pdf-cancel'].forEach(id => {
        document.getElementById(id)?.addEventListener('click', closePdfModal);
    });
    document.getElementById('pdf-download-final')?.addEventListener('click', downloadGeneratedPdf);

    document.getElementById('pdf-break-mode')?.addEventListener('change', e => {
        const custom = document.getElementById('pdf-custom-breaks');
        custom?.classList.toggle('hidden', e.target.value !== 'custom');
        schedulePdfRender();
    });
    document.querySelectorAll('.pdf-break-section').forEach(el => {
        el.addEventListener('change', schedulePdfRender);
    });

    modal.addEventListener('click', e => { if (e.target === modal) closePdfModal(); });
}

function openPdfModal() {
    const modal = document.getElementById('pdf-modal');
    if (!modal) return;
    modal.classList.remove('hidden');
    modal.classList.add('flex');
    renderPdfPreview();
}

function closePdfModal() {
    const modal = document.getElementById('pdf-modal');
    if (!modal) return;
    modal.classList.add('hidden');
    modal.classList.remove('flex');
    if (pdfState.url) URL.revokeObjectURL(pdfState.url);
    pdfState.url = null;
    pdfState.blob = null;
}

let pdfRenderTimer = null;
function schedulePdfRender() {
    clearTimeout(pdfRenderTimer);
    pdfRenderTimer = setTimeout(renderPdfPreview, 180);
}

function getPdfOptions() {
    const page = document.getElementById('pdf-page-size')?.value || 'a4';
    const sizes = {
        a4: { w: 210, h: 297 },
        letter: { w: 215.9, h: 279.4 }
    };
    const size = sizes[page];
    return {
        page,
        pageW: size.w,
        pageH: size.h,
        scale: Number(document.getElementById('pdf-scale')?.value || 100) / 100,
        top: Number(document.getElementById('pdf-margin-top')?.value || 0),
        right: Number(document.getElementById('pdf-margin-right')?.value || 0),
        bottom: Number(document.getElementById('pdf-margin-bottom')?.value || 0),
        left: Number(document.getElementById('pdf-margin-left')?.value || 0),
        breakMode: document.getElementById('pdf-break-mode')?.value || 'auto',
        breakSections: Array.from(document.querySelectorAll('.pdf-break-section:checked')).map(el => el.value)
    };
}

function trimCanvasBottom(sourceCanvas, threshold = 248, padding = 6) {
    const width = sourceCanvas.width;
    const height = sourceCanvas.height;
    if (!width || !height) return sourceCanvas;

    const ctx = sourceCanvas.getContext('2d', { willReadFrequently: true });
    const pixels = ctx.getImageData(0, 0, width, height).data;

    // Search upward for the last row containing meaningful non-white pixels.
    // Sampling every 2nd pixel keeps this fast even at high render resolution.
    let lastContentRow = -1;
    for (let y = height - 1; y >= 0; y -= 2) {
        const rowStart = y * width * 4;
        let found = false;
        for (let x = 0; x < width; x += 2) {
            const i = rowStart + x * 4;
            if (pixels[i] < threshold || pixels[i + 1] < threshold || pixels[i + 2] < threshold || pixels[i + 3] < 245) {
                found = true;
                break;
            }
        }
        if (found) {
            lastContentRow = y;
            break;
        }
    }

    if (lastContentRow < 0 || lastContentRow >= height - padding) return sourceCanvas;

    const newHeight = Math.min(height, lastContentRow + padding + 1);
    const out = document.createElement('canvas');
    out.width = width;
    out.height = newHeight;
    const outCtx = out.getContext('2d');
    outCtx.fillStyle = '#ffffff';
    outCtx.fillRect(0, 0, width, newHeight);
    outCtx.drawImage(sourceCanvas, 0, 0, width, newHeight, 0, 0, width, newHeight);
    return out;
}

async function buildPdfBlob() {
    if (!window.jspdf?.jsPDF || !window.html2canvas) {
        throw new Error('PDF libraries failed to load. Check your internet connection.');
    }

    const opts = getPdfOptions();
    if (opts.left + opts.right >= opts.pageW || opts.top + opts.bottom >= opts.pageH) {
        throw new Error('Margins are too large for the selected page size.');
    }

    const source = document.querySelector('.resume-page');
    if (!source) throw new Error('Resume page not found.');

    // Clone the resume at its native A4 layout width. We never resize the clone
    // with CSS transform or change its font size, so line wrapping stays stable.
    const cloneHost = document.createElement('div');
    cloneHost.style.cssText = `position:fixed;left:-100000px;top:0;width:210mm;background:#fff;z-index:-1;`;
    const clone = source.cloneNode(true);
    clone.style.cssText = `width:210mm;max-width:210mm;min-height:0;height:auto;margin:0;padding:0 10mm;box-sizing:border-box;background:#fff;box-shadow:none;overflow:visible;`;
    cloneHost.appendChild(clone);
    document.body.appendChild(cloneHost);

    // Wait for the browser to finish layout before rasterizing.
    await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));

    const rect = clone.getBoundingClientRect();
    const renderScale = 2.5;
    const canvas = await html2canvas(clone, {
        scale: renderScale,
        useCORS: true,
        backgroundColor: '#ffffff',
        logging: false,
        width: Math.ceil(rect.width),
        height: Math.ceil(rect.height),
        windowWidth: Math.ceil(rect.width),
        windowHeight: Math.ceil(rect.height)
    });

    // Remove trailing blank canvas rows. html2canvas can include a tiny amount
    // of extra height from CSS layout/rounding. Without trimming it, that tiny
    // overflow can be interpreted as a complete third PDF page.
    const trimmedCanvas = trimCanvasBottom(canvas);

    // The resume print layout uses 10mm horizontal internal padding.
    // Crop that padding out of the rendered canvas before placing it into
    // the PDF margin box. This is the important part that makes the PDF
    // Right/Left margin controls refer to the actual visible resume content
    // instead of the hidden internal .resume-page padding.
    const internalPadMm = 10;
    const internalPadPx = Math.round((internalPadMm / 210) * canvas.width);
    const croppedX = Math.max(0, Math.min(canvas.width - 1, internalPadPx));
    const croppedWidth = Math.max(1, canvas.width - (internalPadPx * 2));
    const contentCanvasBase = document.createElement('canvas');
    contentCanvasBase.width = croppedWidth;
    contentCanvasBase.height = trimmedCanvas.height;
    const contentBaseCtx = contentCanvasBase.getContext('2d');
    contentBaseCtx.fillStyle = '#ffffff';
    contentBaseCtx.fillRect(0, 0, contentBaseCtx.canvas.width, contentBaseCtx.canvas.height);
    contentBaseCtx.drawImage(
        trimmedCanvas,
        croppedX, 0, croppedWidth, trimmedCanvas.height,
        0, 0, croppedWidth, trimmedCanvas.height
    );

    // Capture link rectangles before removing the clone. Coordinates are
    // shifted by the cropped internal left padding.
    const links = Array.from(clone.querySelectorAll('a[href]')).map(a => {
        const r = a.getBoundingClientRect();
        return {
            href: a.href,
            x: r.left - rect.left - (internalPadMm / 210) * rect.width,
            y: r.top - rect.top,
            w: r.width,
            h: r.height
        };
    }).filter(l => l.href && l.w > 0 && l.h > 0);

    // Capture section top positions before removing the clone. Custom page
    // breaks are applied to these exact rendered Y coordinates, so they never
    // alter text wrapping or the resume's internal layout.
    const sectionBreaks = opts.breakMode === 'custom'
        ? opts.breakSections.map(id => {
            const el = clone.querySelector(`#${id}`);
            if (!el) return null;
            const r = el.getBoundingClientRect();
            return { id, y: Math.max(0, r.top - rect.top) };
        }).filter(Boolean)
        : [];

    // IMPORTANT: collect safe vertical cut positions from the real DOM.
    // Raster slicing at an arbitrary pixel can cut straight through the last
    // line of a bullet/paragraph. That is what caused the half-visible final
    // line in the PDF. We prefer the nearest completed block/list-item bottom
    // at or before the natural page boundary.
    const safeBreaks = Array.from(clone.querySelectorAll(
        'h1, h2, p, .item-header, .item-sub, li, .experience-item, .custom-resume-section'
    )).map(el => {
        const r = el.getBoundingClientRect();
        return Math.round((r.bottom - rect.top) * renderScale);
    }).filter(y => y > 8 && y < canvas.height - 8);

    cloneHost.remove();

    const pdf = new window.jspdf.jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: opts.page,
        compress: true
    });

    // Convert native CSS pixels to mm. The image is then uniformly scaled;
    // scale changes never cause reflow or font distortion.
    const pxToMm = opts.pageW / rect.width;
    const availableW = opts.pageW - opts.left - opts.right;
    const availableH = opts.pageH - opts.top - opts.bottom;

    // Scale is relative to the printable width. At 100%, the resume exactly
    // fits between the left/right margins. Smaller values create more whitespace;
    // margins therefore remain independently adjustable without changing wrapping.
    const effectiveScale = opts.scale;

    // Margins define the PDF content box. Scale is applied INSIDE that box,
    // so changing the right margin always moves the right edge of the
    // rendered resume exactly to (pageW - right margin). The content is
    // anchored to the left margin instead of being re-centered.
    const finalW = availableW * effectiveScale;
    const xPos = opts.left;

    // Slice the long canvas into printable page-height segments.
    // If the requested scale is >100%, the content may extend beyond the page;
    // keep the setting visible rather than silently changing the user's value.
    const pagePxH = availableH / (pxToMm * effectiveScale);
    const contentCanvas = contentCanvasBase;
    const contentHeight = contentCanvas.height;
    const pageCanvasHeight = Math.ceil(pagePxH * renderScale);

    const pageCanvas = document.createElement('canvas');
    pageCanvas.width = contentCanvas.width;
    pageCanvas.height = pageCanvasHeight;
    const pageCtx = pageCanvas.getContext('2d', { willReadFrequently: true });

    function meaningfulRows(canvas, minDarkPixels = 12) {
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
        let first = canvas.height;
        let last = -1;
        for (let y = 0; y < canvas.height; y += 2) {
            let dark = 0;
            const row = y * canvas.width * 4;
            for (let x = 0; x < canvas.width; x += 3) {
                const i = row + x * 4;
                if (data[i] < 235 || data[i + 1] < 235 || data[i + 2] < 235) {
                    dark++;
                    if (dark >= minDarkPixels) break;
                }
            }
            if (dark >= minDarkPixels) {
                if (first === canvas.height) first = y;
                last = y;
            }
        }
        return last >= first ? { first, last, height: last - first + 1 } : null;
    }

    // Find the last safe DOM boundary before a target pixel position. A small
    // tolerance allows the browser's fractional-pixel layout to land cleanly.
    function nearestSafeBreak(target, minimumProgress = 120) {
        const candidates = safeBreaks
            .filter(y => y > minimumProgress && y <= target + 2)
            .sort((a, b) => b - a);
        return candidates.length ? candidates[0] : target;
    }

    // Keep each page from cutting through a text line/list item. If no safe
    // boundary exists in the current page, fall back to the exact page edge;
    // this only happens when a single block itself is taller than a page.
    function buildAutomaticSlices() {
        const out = [];
        let cursor = 0;
        const finalMinContentPx = Math.max(18, Math.round(pageCanvasHeight * 0.018));

        while (cursor < contentHeight - 1) {
            const naturalEnd = Math.min(cursor + pageCanvasHeight, contentHeight);
            let end = naturalEnd;

            if (naturalEnd < contentHeight) {
                const safe = nearestSafeBreak(naturalEnd, cursor + 120);
                if (safe > cursor + 40) end = safe;
            }

            const sh = end - cursor;
            if (sh <= 0) break;
            out.push({ sy: cursor, sh });
            cursor = end;
        }

        // A tiny final remainder caused by fractional CSS/raster rounding is
        // discarded, but real content is never discarded.
        if (out.length > 1) {
            const last = out[out.length - 1];
            if (last.sh < finalMinContentPx) out.pop();
        }
        return out;
    }

    function buildCustomSlices() {
        const forced = [...new Set(sectionBreaks
            .map(b => Math.max(0, Math.min(contentHeight, Math.round(b.y * renderScale)))))]
            .filter(y => y > 8 && y < contentHeight - 8)
            .sort((a, b) => a - b);

        const out = [];
        let cursor = 0;

        for (const breakY of forced) {
            // First fill normal pages until the selected section can be placed
            // on a fresh page. Do not cut the preceding content mid-line.
            while (breakY - cursor > pageCanvasHeight) {
                const naturalEnd = Math.min(cursor + pageCanvasHeight, breakY);
                const safe = nearestSafeBreak(naturalEnd, cursor + 120);
                const end = safe > cursor + 40 ? safe : naturalEnd;
                out.push({ sy: cursor, sh: end - cursor });
                cursor = end;
            }

            if (breakY > cursor + 8) {
                out.push({ sy: cursor, sh: breakY - cursor });
                cursor = breakY;
            }
        }

        while (cursor < contentHeight - 1) {
            const naturalEnd = Math.min(cursor + pageCanvasHeight, contentHeight);
            let end = naturalEnd;
            if (naturalEnd < contentHeight) {
                const safe = nearestSafeBreak(naturalEnd, cursor + 120);
                if (safe > cursor + 40) end = safe;
            }
            out.push({ sy: cursor, sh: end - cursor });
            cursor = end;
        }
        return out;
    }

    const slices = opts.breakMode === 'custom' && sectionBreaks.length
        ? buildCustomSlices()
        : buildAutomaticSlices();

    slices.forEach(slice => {
        pageCtx.clearRect(0, 0, pageCanvas.width, pageCanvas.height);
        pageCtx.fillStyle = '#ffffff';
        pageCtx.fillRect(0, 0, pageCanvas.width, pageCanvas.height);
        pageCtx.drawImage(contentCanvas, 0, slice.sy, contentCanvas.width, slice.sh, 0, 0, contentCanvas.width, slice.sh);
        slice.bounds = meaningfulRows(pageCtx.canvas);
    });

    // Never keep a genuinely empty/tiny final rendering remainder. Custom
    // breaks are allowed to create a short page only when that page has real
    // content.
    if (slices.length > 1) {
        const last = slices[slices.length - 1];
        const finalMinContentPx = Math.max(18, Math.round(pageCanvasHeight * 0.018));
        if ((!last.bounds || last.bounds.height < finalMinContentPx) && opts.breakMode !== 'custom') {
            slices.pop();
        }
    }

    slices.forEach((slice, page) => {
        if (page > 0) pdf.addPage(opts.page);
        pageCtx.clearRect(0, 0, pageCanvas.width, pageCanvas.height);
        pageCtx.fillStyle = '#ffffff';
        pageCtx.fillRect(0, 0, pageCanvas.width, pageCanvas.height);
        pageCtx.drawImage(contentCanvas, 0, slice.sy, contentCanvas.width, slice.sh, 0, 0, contentCanvas.width, slice.sh);

        const pageImgH = Math.min(availableH, (slice.sh / renderScale) * pxToMm * effectiveScale);

        pdf.addImage(
            pageCanvas.toDataURL('image/jpeg', 0.96),
            'JPEG',
            xPos,
            opts.top,
            finalW,
            pageImgH,
            undefined,
            'FAST'
        );

        // Link annotations must use this slice's actual Y origin. Using
        // page * pagePxH breaks as soon as a page is snapped to a safe DOM
        // boundary, so calculate against slice.sy instead.
        const sliceStartCss = slice.sy / renderScale;
        const sliceEndCss = (slice.sy + slice.sh) / renderScale;
        links.forEach(link => {
            const linkY = link.y;
            const linkBottom = link.y + link.h;
            if (linkBottom <= sliceStartCss || linkY >= sliceEndCss) return;

            const yWithin = Math.max(0, linkY - sliceStartCss);
            const hWithin = Math.min(link.h, sliceEndCss - Math.max(linkY, sliceStartCss));
            if (hWithin <= 0) return;

            const xMm = xPos + link.x * pxToMm * effectiveScale;
            const yMm = opts.top + yWithin * pxToMm * effectiveScale;
            const wMm = Math.min(link.w * pxToMm * effectiveScale, Math.max(0, opts.pageW - opts.right - xMm));
            const hMm = hWithin * pxToMm * effectiveScale;
            if (wMm > 0 && hMm > 0) {
                pdf.link(xMm, yMm, wMm, hMm, { url: link.href });
            }
        });
    });

    return pdf.output('blob');
}

async function renderPdfPreview() {
    if (pdfState.rendering) return;
    pdfState.rendering = true;
    const status = document.getElementById('pdf-preview-status');
    const downloadBtn = document.getElementById('pdf-download-final');
    if (status) status.textContent = 'Rendering…';
    if (downloadBtn) downloadBtn.disabled = true;

    try {
        const blob = await buildPdfBlob();
        pdfState.blob = blob;
        if (pdfState.url) URL.revokeObjectURL(pdfState.url);
        pdfState.url = URL.createObjectURL(blob);
        const frame = document.getElementById('pdf-preview');
        if (frame) frame.src = pdfState.url;
        if (status) status.textContent = 'Ready';
        if (downloadBtn) downloadBtn.disabled = false;
    } catch (err) {
        console.error('PDF generation failed:', err);
        if (status) status.textContent = err.message || 'Unable to render PDF';
    } finally {
        pdfState.rendering = false;
    }
}

function downloadGeneratedPdf() {
    if (!pdfState.blob) return;
    const name = (currentData?.header?.name || 'resume').replace(/[^a-z0-9]+/gi, '_').replace(/^_|_$/g, '') || 'resume';
    const a = document.createElement('a');
    a.href = URL.createObjectURL(pdfState.blob);
    a.download = `${name}.pdf`;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
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