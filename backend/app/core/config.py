from typing import Dict

DB_NAME = "corporate_data.db"

EXCEL_FILES_CONFIG: Dict[str, Dict[str, str]] = {
    "StaffMaintenance_Attendacne_DummyData_Aug2025_Jan2026.xlsx": {
        "Department Summary": "Department_Summary",
        "Payroll Summary": "Payroll_Summary",
        "Attendance Records": "Attendance_Records",
        "Staff Maintenance": "Staff_Maintenance"
    },
    "Sales_Data_Aug2025_Jan2026_Dummy.xlsx": {
        "SKU Performance": "SKU_Performance",
        "Quarterly Performance": "Quarterly_Performance",
        "Cost Analysis": "Cost_Analysis",
        "Monthly Trend Analysis": "Monthly_Trend_Analysis",
        "Top 20 Branches": "Top_20_Branches",
        "Payment Mode Analysis": "Payment_Mode_Analysis",
        "Category Performance": "Category_Performance",
        "Monthly Overall Summary": "Monthly_Overall_Summary",
        "Branch Details": "Branch_Details",
        "State Performance": "State_Performance",
        "Monthly Category Summary": "Monthly_Category_Summary",
        "Daily Sales Transactions": "Daily_Sales_Transactions"
    }
}
