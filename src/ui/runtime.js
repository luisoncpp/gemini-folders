const NO_OP = () => {};

let rerenderSidebarHandler = NO_OP;

export function setSidebarRerenderHandler(handler) {
    rerenderSidebarHandler = handler;
}

export function rerenderSidebar() {
    rerenderSidebarHandler();
}
