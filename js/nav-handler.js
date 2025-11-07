document.addEventListener('DOMContentLoaded', () => {
    const currentPath = window.location.pathname;

    const getActivePath = () => {
        if (currentPath.endsWith('/index.html')) {
            return currentPath.substring(0, currentPath.lastIndexOf('/') + 1);
        }
        if (!currentPath.endsWith('/')) {
            return currentPath + '/';
        }
        return currentPath;
    };

    const activePath = getActivePath();

    const sidebarLinks = document.querySelectorAll('.sidebar-nav-link');
    const bottomNavButtons = document.querySelectorAll('.bottom-bar .nav-button');

    sidebarLinks.forEach(link => {
        const linkPath = link.getAttribute('href');
        if (linkPath === activePath) {
            link.classList.add('active');
        }
    });

    bottomNavButtons.forEach(link => {
        const linkPath = link.getAttribute('href');
        if (linkPath === activePath) {
            link.classList.add('active');
        }
    });
});