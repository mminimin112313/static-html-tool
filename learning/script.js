document.addEventListener('DOMContentLoaded', () => {
    // --- STATE MANAGEMENT ---
    const state = {
        projects: [
            {
                id: 1,
                title: 'Welcome to the App',
                content: '# Hello!\n\nThis is your first project. You can edit this content using Markdown.\n\n**Features:**\n\n* Real-time Markdown preview\n* Add new projects\n* Simple, clean interface',
            },
            {
                id: 2,
                title: 'Getting Started',
                content: '# Getting Started Guide\n\n1.  Click "New Project" to create a new document.\n2.  Select a project from the sidebar to view it.\n3.  The content is rendered from Markdown to HTML instantly.',
            }
        ],
        activeProjectId: 1,
    };

    // --- DOM ELEMENT REFERENCES ---
    const projectListEl = document.querySelector('.project-list');
    const projectTitleEl = document.getElementById('project-title');
    const contentViewEl = document.querySelector('.content-view');
    const newProjectBtn = document.getElementById('new-project-btn');

    // --- RENDER FUNCTIONS ---
    function renderProjectList() {
        projectListEl.innerHTML = ''; // Clear existing list
        state.projects.forEach(project => {
            const projectItem = document.createElement('div');
            projectItem.textContent = project.title;
            projectItem.classList.add('project-list-item');
            if (project.id === state.activeProjectId) {
                projectItem.classList.add('active');
            }
            projectItem.dataset.id = project.id;
            projectListEl.appendChild(projectItem);
        });
    }

    function renderActiveProject() {
        const activeProject = state.projects.find(p => p.id === state.activeProjectId);
        if (activeProject) {
            projectTitleEl.textContent = activeProject.title;
            // Using the 'marked' library linked in the HTML
            contentViewEl.innerHTML = marked.parse(activeProject.content);
        }
    }

    // --- EVENT LISTENERS ---
    projectListEl.addEventListener('click', (e) => {
        if (e.target.matches('.project-list-item')) {
            const projectId = parseInt(e.target.dataset.id, 10);
            state.activeProjectId = projectId;
            renderProjectList();
            renderActiveProject();
        }
    });

    newProjectBtn.addEventListener('click', () => {
        const newId = state.projects.length > 0 ? Math.max(...state.projects.map(p => p.id)) + 1 : 1;
        const newProject = {
            id: newId,
            title: `Untitled Project ${newId}`,
            content: '# New Project\n\nStart writing your content here.',
        };
        state.projects.push(newProject);
        state.activeProjectId = newId;
        renderProjectList();
        renderActiveProject();
    });

    // --- INITIALIZATION ---
    function init() {
        feather.replace(); // Initialize Feather Icons
        renderProjectList();
        renderActiveProject();
    }

    init();
});
