#!/usr/bin/env python3
import argparse
import sys
import os
from pathlib import Path
from .service_manager import HiVoidManager

def clear_screen():
    os.system('cls' if os.name == 'nt' else 'clear')

def show_interactive_menu():
    manager = HiVoidManager()
    
    while True:
        clear_screen()
        print("\033[1m" + "="*50 + "\033[0m")
        print("         \033[1;36mHiVoid Service Management Menu\033[0m")
        print("\033[1m" + "="*50 + "\033[0m")
        print("  \033[1;33m1)\033[0m Start Core Service")
        print("  \033[1;33m2)\033[0m Stop Core Service")
        print("  \033[1;33m3)\033[0m Restart Core Service")
        print("  \033[1;33m4)\033[0m Check Operational Status")
        print("  \033[1;33m5)\033[0m Update Core (GitHub Releases)")
        print("  \033[1;33m6)\033[0m Reset Administrator Password")
        print("  \033[1;33m7)\033[0m Change Web Panel Port")
        print("  \033[1;31m8)\033[0m Delete Service (Dangerous)")
        print("  " + "-"*46)
        print("  \033[1;37m0)\033[0m Exit")
        print("\033[1m" + "="*50 + "\033[0m")

        choice = input("\033[1;32mSelect an option [0-8]: \033[0m")

        if choice == "0":
            print("\nExiting HiVoid Manager. Goodbye!")
            break
        elif choice == "1":
            print("\nStarting core service...")
            manager.start_service()
            input("\nPress ENTER to continue...")
        elif choice == "2":
            print("\nStopping core service...")
            manager.stop_service()
            input("\nPress ENTER to continue...")
        elif choice == "3":
            print("\nRestarting core service...")
            manager.restart_service()
            input("\nPress ENTER to continue...")
        elif choice == "4":
            res = manager.get_status()
            print(f"\nStatus: {res['status'].upper()} (PID: {res['pid']})")
            input("\nPress ENTER to continue...")
        elif choice == "5":
            print("\nUpdating core...")
            manager.update_core()
            input("\nPress ENTER to continue...")
        elif choice == "6":
            new_pass = input("\nEnter new secure password: ")
            if new_pass:
                manager.reset_admin_password(new_pass)
            input("\nPress ENTER to continue...")
        elif choice == "7":
            new_port = input("\nEnter new Panel Port (1-65535): ")
            if new_port.isdigit():
                manager.change_panel_port(int(new_port))
            else:
                print("Invalid port number.")
            input("\nPress ENTER to continue...")
        elif choice == "8":
            confirm = input("\nARE YOU REALY SURE? (y/N): ")
            if confirm.lower() == 'y':
                manager.delete_service()
                print("System purged.")
                break
        else:
            print("\nInvalid selection.")
            input("\nPress ENTER to retry...")

def main():
    if len(sys.argv) == 1:
        try:
            show_interactive_menu()
        except KeyboardInterrupt:
            print("\nInterrupted by user. Closing.")
        return

    manager = HiVoidManager()
    parser = argparse.ArgumentParser(description="HiVoid Service Management CLI")
    subparsers = parser.add_subparsers(dest="command", help="Available commands")

    subparsers.add_parser("start", help="Start service")
    subparsers.add_parser("stop", help="Stop service")
    subparsers.add_parser("restart", help="Restart service")
    subparsers.add_parser("status", help="Check status")
    subparsers.add_parser("update", help="Update core")
    
    reset_pass_parser = subparsers.add_parser("reset-pass", help="Reset password")
    reset_pass_parser.add_argument("password", help="The new password")

    change_port_parser = subparsers.add_parser("change-port", help="Change panel port")
    change_port_parser.add_argument("port", type=int, help="New port number")
    
    subparsers.add_parser("delete", help="Delete service")

    args = parser.parse_args()

    if args.command == "start":
        manager.start_service()
    elif args.command == "stop":
        manager.stop_service()
    elif args.command == "restart":
        manager.restart_service()
    elif args.command == "status":
        print(manager.get_status())
    elif args.command == "update":
        manager.update_core()
    elif args.command == "reset-pass":
        manager.reset_admin_password(args.password)
    elif args.command == "change-port":
        manager.change_panel_port(args.port)
    elif args.command == "delete":
        manager.delete_service()
    else:
        parser.print_help()

if __name__ == "__main__":
    main()
