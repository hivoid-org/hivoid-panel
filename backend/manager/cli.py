#!/usr/bin/env python3
import argparse
import sys
import os
from pathlib import Path
from .service_manager import HiVoidManager

def clear_screen():
    os.system('cls' if os.name == 'nt' else 'clear')

def print_banner():
    banner = r"""
    \033[1;36m
    ██╗  ██╗██╗██╗   ██╗ ██████╗ ██╗██████╗ 
    ██║  ██║██║██║   ██║██╔═══██╗██║██╔══██╗
    ███████║██║██║   ██║██║   ██║██║██║  ██║
    ██╔══██║██║╚██╗ ██╔╝██║   ██║██║██║  ██║
    ██║  ██║██║ ╚████╔╝ ╚██████╔╝██║██████╔╝
    ╚═╝  ╚═╝╚═╝  ╚═══╝   ╚═════╝ ╚═╝╚═════╝ 
    \033[0m
    """
    print(banner.replace("\\033", "\033"))

def show_interactive_menu():
    manager = HiVoidManager()
    
    while True:
        clear_screen()
        print_banner()
        stats = manager.get_system_stats()
        
        print(f"  \033[1;30mCORE: {stats['cpu_percent']}% CPU | {stats['ram_percent']}% RAM | {stats['disk_percent']}% DISK\033[0m\n")
        
        menu_lines = [
            "\033[1;34m⚡ SERVICE CONTROL\033[0m",
            "  \033[0;33m1)\033[0m Start Engine        \033[0;33m2)\033[0m Stop Engine",
            "  \033[0;33m3)\033[0m Restart Engine      \033[0;33m4)\033[0m Operational Status\n",
            
            "\033[1;34m🛠️  SYSTEM UTILITIES\033[0m",
            "  \033[0;33mL)\033[0m View Live Logs      \033[0;33mB)\033[0m Create System Backup",
            "  \033[0;33mR)\033[0m Restore from Zip    \033[0;33mA)\033[0m Boot Auto-start Settings\n",
            
            "\033[1;34m⚙️  CONFIGURATION\033[0m",
            "  \033[0;33m5)\033[0m Update Core Binary   \033[0;33m6)\033[0m Synchronize Panel UI",
            "  \033[0;33m7)\033[0m Reset Admin Pass     \033[0;33m8)\033[0m Change Panel Web Port\n",
            
            "\033[1;31m🛑 MAINTENANCE\033[0m",
            "  \033[1;31m9)\033[1;31m UNINSTALL HIVOID SYSTEM\033[0m",
            "  \033[0;37m0)\033[0m Exit Manager\n"
        ]
        
        print("\n".join(menu_lines))

        choice = input("\033[1;32mSelect option index: \033[0m").upper()

        if choice == "0":
            print("\033[1;34mExiting HiVoid Manager. Stay Secure.\033[0m")
            break
        elif choice == "1":
            print("\n\033[1;36m>>> Booting core service...\033[0m")
            manager.start_service()
            input("\nPress ENTER to return...")
        elif choice == "2":
            print("\n\033[1;31m>>> Halting engine...\033[0m")
            manager.stop_service()
            input("\nPress ENTER to return...")
        elif choice == "3":
            print("\n\033[1;36m>>> Restarting lifecycle...\033[0m")
            manager.restart_service()
            input("\nPress ENTER to return...")
        elif choice == "4":
            res = manager.get_status()
            color = "\033[1;32m" if res['status'] == 'running' else "\033[1;31m"
            print(f"\n\033[1;37mSYSTEM STATUS:\033[0m {color}{res['status'].upper()}\033[0m")
            print(f"\033[1;37mPROCESS ID:   \033[0m {res['pid'] if res['pid'] else 'N/A'}")
            input("\nPress ENTER to return...")
        elif choice == "L":
            print("\n\033[1;33m1) Core Service Logs\033[0m")
            print("\033[1;33m2) Web Panel Logs\033[0m")
            l_choice = input("Select log source: ")
            if l_choice == "1": manager.view_logs("core")
            elif l_choice == "2": manager.view_logs("panel")
        elif choice == "B":
            print("\n\033[1;36m>>> Archiving configuration and data...\033[0m")
            path = manager.create_backup()
            if path: print(f"\033[1;32mBackup saved: {path}\033[0m")
            input("\nPress ENTER to return...")
        elif choice == "R":
            backups = list(manager.backup_dir.glob("*.zip"))
            if not backups:
                print("\033[1;31mNo backups found in data/backups/\033[0m")
            else:
                print("\n\033[1;37mAvailable Backups:\033[0m")
                for i, b in enumerate(backups): print(f"{i+1}) {b.name}")
                r_choice = input("\nSelect index to restore: ")
                if r_choice.isdigit() and int(r_choice) <= len(backups):
                    manager.restore_backup(str(backups[int(r_choice)-1]))
                    print("\033[1;32mSystem state restored.\033[0m")
            input("\nPress ENTER to return...")
        elif choice == "A":
            print("\n\033[1;33m1) Enable Auto-start on boot\033[0m")
            print("\033[1;33m2) Disable Auto-start on boot\033[0m")
            a_choice = input("Selection: ")
            manager.toggle_autostart(enable=(a_choice=="1"))
            print("\033[1;32mBoot persistence configuration updated.\033[0m")
            input("\nPress ENTER to return...")
        elif choice == "5":
            print("\n\033[1;36m>>> Pulling latest core binary...\033[0m")
            manager.update_core()
            input("\nPress ENTER to return...")
        elif choice == "6":
            print("\n\033[1;36m>>> Refreshing web panel assets...\033[0m")
            manager.update_panel()
            input("\nPress ENTER to return...")
        elif choice == "7":
            new_pass = input("\n\033[1;37mEnter new master password: \033[0m")
            if new_pass:
                manager.reset_admin_password(new_pass)
                print("\033[1;32mPassword synced successfully.\033[0m")
            input("\nPress ENTER to return...")
        elif choice == "8":
            new_port = input("\n\033[1;37mEnter new Web UI Port (1-65535): \033[0m")
            if new_port.isdigit():
                manager.change_panel_port(int(new_port))
                print(f"\033[1;32mWeb UI migrated to port {new_port}.\033[0m")
            else:
                print("\033[1;31mError: Port must be numeric.\033[0m")
            input("\nPress ENTER to return...")
        elif choice == "9":
            print("\n\033[1;31m⚠️  CRITICAL: This will remove all config, data, and binaries!\033[0m")
            confirm = input("\033[1;31mType 'CONFIRM' to uninstall: \033[0m")
            if confirm == 'CONFIRM':
                manager.uninstall_service()
                print("\033[1;31mHiVoid Ecosystem has been removed from this node.\033[0m")
                break
        else:
            print("\033[1;31mSelection outside valid range.\033[0m")
            input("\nPress ENTER to retry...")

def main():
    if len(sys.argv) == 1:
        try:
            show_interactive_menu()
        except KeyboardInterrupt:
            print("\n\033[1;34mOperation cancelled by user.\033[0m")
        return

    manager = HiVoidManager()
    parser = argparse.ArgumentParser(description="HiVoid Service Management Utility")
    subparsers = parser.add_subparsers(dest="command", help="Management commands")

    subparsers.add_parser("start", help="Start the HiVoid core engine")
    subparsers.add_parser("stop", help="Stop the HiVoid core engine")
    subparsers.add_parser("restart", help="Perform engine restart")
    subparsers.add_parser("status", help="Get engine operational status")
    
    update_parser = subparsers.add_parser("update", help="Synchronize system components")
    update_group = update_parser.add_mutually_exclusive_group()
    update_group.add_argument("--core", action="store_true", help="Sync only core binary")
    update_group.add_argument("--panel", action="store_true", help="Sync only web panel assets")
    update_group.add_argument("--all", action="store_true", help="Sync all components (default)")
    
    reset_pass_parser = subparsers.add_parser("reset-pass", help="Set a new administrative password")
    reset_pass_parser.add_argument("password", help="The new plain-text password")

    change_port_parser = subparsers.add_parser("change-port", help="Modify the panel listening port")
    change_port_parser.add_argument("port", type=int, help="New numeric port")
    
    subparsers.add_parser("uninstall", help="Permanently remove the service from system")
    subparsers.add_parser("backup", help="Create a manual system backup")
    
    logs_parser = subparsers.add_parser("logs", help="View live service logs")
    logs_parser.add_argument("--type", choices=["core", "panel"], default="core", help="Target service logs")

    args = parser.parse_args()

    if args.command == "start":
        manager.start_service()
    elif args.command == "stop":
        manager.stop_service()
    elif args.command == "restart":
        manager.restart_service()
    elif args.command == "status":
        res = manager.get_status()
        print(f"STATUS: {res['status'].upper()}")
        print(f"PID:    {res['pid'] if res['pid'] else 'N/A'}")
    elif args.command == "update":
        if args.panel: manager.update_panel()
        elif args.core: manager.update_core()
        else:
            manager.update_core()
            manager.update_panel()
    elif args.command == "reset-pass":
        manager.reset_admin_password(args.password)
    elif args.command == "change-port":
        manager.change_panel_port(args.port)
    elif args.command == "uninstall":
        manager.uninstall_service()
    elif args.command == "backup":
        manager.create_backup()
    elif args.command == "logs":
        manager.view_logs(args.type)
    else:
        parser.print_help()

if __name__ == "__main__":
    main()
