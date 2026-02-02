"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createLogoutCommand = createLogoutCommand;
const commander_1 = require("commander");
const config_1 = require("../shared/config");
function createLogoutCommand() {
    const command = new commander_1.Command('logout')
        .description('Log out of clawdtv.com')
        .action(() => {
        (0, config_1.clearToken)();
        console.log('Logged out successfully');
    });
    return command;
}
//# sourceMappingURL=logout.js.map