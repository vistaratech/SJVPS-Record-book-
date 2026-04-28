// Template definitions — exact mirror of web app's templates.ts, using Ionicons instead of emojis

export const CATEGORIES = [
  { id: 'property', icon: 'home', color: '#3B82F6', name: 'Property' },
  { id: 'school', icon: 'school', color: '#10B981', name: 'School' },
  { id: 'shop', icon: 'storefront', color: '#F59E0B', name: 'Shop' },
  { id: 'transport', icon: 'bus', color: '#6366F1', name: 'Transport' },
  { id: 'wholesaler', icon: 'business', color: '#8B5CF6', name: 'Whole Saler' },
  { id: 'distributors', icon: 'cube', color: '#EC4899', name: 'Distributors' },
  { id: 'event', icon: 'calendar', color: '#EF4444', name: 'Event Management' },
  { id: 'hospitals', icon: 'medkit', color: '#14B8A6', name: 'Hospitals' },
  { id: 'restaurant', icon: 'restaurant', color: '#F97316', name: 'Restaurant Canteen' },
  { id: 'fitness', icon: 'barbell', color: '#06B6D4', name: 'Health Fitness' },
  { id: 'apartment', icon: 'business', color: '#64748B', name: 'Apartment' },
  { id: 'student', icon: 'person', color: '#0284C7', name: 'Student' },
  { id: 'insurance', icon: 'shield-checkmark', color: '#059669', name: 'Insurance Agent' },
  { id: 'farming', icon: 'leaf', color: '#84CC16', name: 'Farming' },
  { id: 'travel', icon: 'airplane', color: '#D946EF', name: 'Travel' },
];

export interface TemplateColumn {
  name: string;
  type: string;
  formula?: string;
  dropdownOptions?: string[];
}

export const DEFAULT_BLANK_COLUMNS: TemplateColumn[] = [
  { name: 'Column 1', type: 'text' },
  { name: 'Column 2', type: 'text' },
  { name: 'Column 3', type: 'text' },
  { name: 'Column 4', type: 'text' },
  { name: 'Column 5', type: 'text' },
];

export interface Template {
  name: string;
  columns: TemplateColumn[];
  icon: string;
  description: string;
}

export const TEMPLATES: Record<string, Template[]> = {
  student: [
    { name: 'Test Marks History', columns: [{ name: 'Date', type: 'date' }, { name: 'Topic', type: 'text' }, { name: 'Full Marks', type: 'number' }, { name: 'Marks Obtained', type: 'number' }, { name: 'Percentage', type: 'formula', formula: '{Marks Obtained}/{Full Marks}*100' }, { name: 'Remarks', type: 'text' }], icon: 'document-text', description: 'Track test scores with auto-calculated percentage' },
    { name: 'Syllabus Tracking', columns: [{ name: 'Topic', type: 'text' }, { name: 'Chapter', type: 'text' }, { name: 'Status', type: 'dropdown' }, { name: 'Deadline', type: 'date' }], icon: 'library', description: 'Track syllabus completion' },
    { name: 'Exam Dates', columns: [{ name: 'Exam', type: 'text' }, { name: 'Date', type: 'date' }, { name: 'Time', type: 'text' }, { name: 'Venue', type: 'text' }, { name: 'Status', type: 'dropdown' }], icon: 'calendar', description: 'Upcoming exam schedule' },
    { name: 'Note Book', columns: [{ name: 'Topic', type: 'text' }, { name: 'Description', type: 'text' }, { name: 'Column', type: 'text' }], icon: 'journal', description: 'General notebook' },
    { name: 'Blank Register', columns: [], icon: 'document', description: 'Start from scratch' },
  ],
  property: [
    { name: 'Property Listing', columns: [{ name: 'Property Name', type: 'text' }, { name: 'Location', type: 'text' }, { name: 'Type', type: 'dropdown' }, { name: 'Price', type: 'number' }, { name: 'Status', type: 'dropdown' }], icon: 'business', description: 'List of properties' },
    { name: 'Rent Collection', columns: [{ name: 'Tenant', type: 'text' }, { name: 'Property', type: 'text' }, { name: 'Monthly Rent', type: 'number' }, { name: 'Paid Date', type: 'date' }, { name: 'Receipt No', type: 'text' }, { name: 'Balance', type: 'number' }], icon: 'cash', description: 'Track rent payments' },
    { name: 'Maintenance Log', columns: [{ name: 'Date', type: 'date' }, { name: 'Issue', type: 'text' }, { name: 'Property', type: 'text' }, { name: 'Status', type: 'dropdown' }, { name: 'Cost', type: 'number' }, { name: 'Remarks', type: 'text' }], icon: 'construct', description: 'Maintenance records' },
    { name: 'Blank Register', columns: [], icon: 'document', description: 'Start from scratch' },
  ],
  school: [
    { name: 'Attendance Register', columns: [{ name: 'Student Name', type: 'text' }, { name: 'Roll No', type: 'text' }, { name: 'Date', type: 'date' }, { name: 'Status', type: 'dropdown', dropdownOptions: ['Present', 'Absent', 'Late', 'Leave'] }, { name: 'Remarks', type: 'text' }], icon: 'checkmark-circle', description: 'Daily attendance tracking with status dropdown' },
    { name: 'Fee Collection', columns: [{ name: 'Student Name', type: 'text' }, { name: 'Class', type: 'dropdown', dropdownOptions: ['1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th', '9th', '10th', '11th', '12th'] }, { name: 'Total Fees', type: 'number' }, { name: 'Amount Paid', type: 'number' }, { name: 'Balance', type: 'formula', formula: '{Total Fees}-{Amount Paid}' }, { name: 'Paid Date', type: 'date' }, { name: 'Receipt No', type: 'text' }, { name: 'Status', type: 'dropdown', dropdownOptions: ['Paid', 'Partial', 'Pending', 'Overdue'] }], icon: 'cash', description: 'Track student fees with auto-calculated balance' },
    { name: 'Exam Results', columns: [{ name: 'Student Name', type: 'text' }, { name: 'Subject', type: 'text' }, { name: 'Full Marks', type: 'number' }, { name: 'Marks Obtained', type: 'number' }, { name: 'Percentage', type: 'formula', formula: '{Marks Obtained}/{Full Marks}*100' }, { name: 'Grade', type: 'dropdown', dropdownOptions: ['A+', 'A', 'B+', 'B', 'C', 'D', 'F'] }], icon: 'trending-up', description: 'Student test results with auto-calculated percentage' },
    { name: 'Staff Salary', columns: [{ name: 'Employee Name', type: 'text' }, { name: 'Role', type: 'dropdown', dropdownOptions: ['Teacher', 'Staff', 'Admin', 'Peon', 'Driver', 'Other'] }, { name: 'Month', type: 'text' }, { name: 'Basic Pay', type: 'number' }, { name: 'Allowances', type: 'number' }, { name: 'Deductions', type: 'number' }, { name: 'Net Pay', type: 'formula', formula: '{Basic Pay}+{Allowances}-{Deductions}' }, { name: 'Status', type: 'dropdown', dropdownOptions: ['Paid', 'Pending'] }], icon: 'cash', description: 'Employee salaries with auto-calculated net pay' },
    { name: 'Blank Register', columns: [], icon: 'document', description: 'Start from scratch' },
  ],
  shop: [
    { name: 'Inventory', columns: [{ name: 'Item Name', type: 'text' }, { name: 'SKU', type: 'text' }, { name: 'Quantity', type: 'number' }, { name: 'Unit Price', type: 'number' }, { name: 'Reorder Level', type: 'number' }, { name: 'Supplier', type: 'text' }], icon: 'cube', description: 'Stock levels' },
    { name: 'Sales Register', columns: [{ name: 'Date', type: 'date' }, { name: 'Item', type: 'text' }, { name: 'Qty Sold', type: 'number' }, { name: 'Rate', type: 'number' }, { name: 'Total', type: 'number' }, { name: 'Payment Mode', type: 'dropdown' }], icon: 'cart', description: 'Daily sales' },
    { name: 'Purchase Register', columns: [{ name: 'Date', type: 'date' }, { name: 'Supplier', type: 'text' }, { name: 'Item', type: 'text' }, { name: 'Qty', type: 'number' }, { name: 'Rate', type: 'number' }, { name: 'Total', type: 'number' }, { name: 'Invoice No', type: 'text' }], icon: 'download', description: 'Stock purchases' },
    { name: 'Customer Ledger', columns: [{ name: 'Customer Name', type: 'text' }, { name: 'Date', type: 'date' }, { name: 'Debit', type: 'number' }, { name: 'Credit', type: 'number' }, { name: 'Balance', type: 'number' }], icon: 'book', description: 'Customer accounts' },
    { name: 'Blank Register', columns: [], icon: 'document', description: 'Start from scratch' },
  ],
  transport: [
    { name: 'Vehicle Log', columns: [{ name: 'Vehicle No', type: 'text' }, { name: 'Driver', type: 'text' }, { name: 'From', type: 'text' }, { name: 'To', type: 'text' }, { name: 'KM Driven', type: 'number' }, { name: 'Date', type: 'date' }], icon: 'bus', description: 'Trip logs' },
    { name: 'Fuel Register', columns: [{ name: 'Date', type: 'date' }, { name: 'Vehicle No', type: 'text' }, { name: 'Liters', type: 'number' }, { name: 'Cost/Liter', type: 'number' }, { name: 'Total Cost', type: 'number' }, { name: 'KM Reading', type: 'number' }], icon: 'color-fill', description: 'Fuel expenses' },
    { name: 'Expense Log', columns: [{ name: 'Date', type: 'date' }, { name: 'Vehicle', type: 'text' }, { name: 'Expense Type', type: 'text' }, { name: 'Amount', type: 'number' }, { name: 'Paid By', type: 'text' }, { name: 'Remarks', type: 'text' }], icon: 'receipt', description: 'Other expenses' },
    { name: 'Blank Register', columns: [], icon: 'document', description: 'Start from scratch' },
  ],
  hospitals: [
    { name: 'Patient Register', columns: [{ name: 'Name', type: 'text' }, { name: 'Age', type: 'number' }, { name: 'Gender', type: 'dropdown' }, { name: 'Diagnosis', type: 'text' }, { name: 'Doctor', type: 'text' }, { name: 'Admission', type: 'date' }, { name: 'Discharge', type: 'date' }], icon: 'bed', description: 'Inpatient list' },
    { name: 'Medicine Stock', columns: [{ name: 'Medicine', type: 'text' }, { name: 'Batch No', type: 'text' }, { name: 'Qty', type: 'number' }, { name: 'Expiry', type: 'date' }, { name: 'Unit Price', type: 'number' }, { name: 'Total Value', type: 'number' }], icon: 'medical', description: 'Pharmacy inventory' },
    { name: 'Appointment Book', columns: [{ name: 'Patient', type: 'text' }, { name: 'Doctor', type: 'text' }, { name: 'Date', type: 'date' }, { name: 'Time', type: 'text' }, { name: 'Status', type: 'dropdown' }, { name: 'Notes', type: 'text' }], icon: 'pulse', description: 'Doctor appointments' },
    { name: 'Blank Register', columns: [], icon: 'document', description: 'Start from scratch' },
  ],
  distributors: [
    { name: 'Product Ledger', columns: [{ name: 'Product Name', type: 'text' }, { name: 'SKU', type: 'text' }, { name: 'Qty Dispatched', type: 'number' }, { name: 'Customer', type: 'text' }, { name: 'Date', type: 'date' }, { name: 'Invoice No', type: 'text' }], icon: 'cube', description: 'Product dispatches' },
    { name: 'Delivery Log', columns: [{ name: 'Date', type: 'date' }, { name: 'Customer', type: 'text' }, { name: 'Items', type: 'text' }, { name: 'Driver', type: 'text' }, { name: 'Status', type: 'dropdown' }, { name: 'Remarks', type: 'text' }], icon: 'bus', description: 'Delivery tracking' },
    { name: 'Payment Tracker', columns: [{ name: 'Customer', type: 'text' }, { name: 'Invoice No', type: 'text' }, { name: 'Amount', type: 'number' }, { name: 'Paid', type: 'number' }, { name: 'Balance', type: 'number' }, { name: 'Date', type: 'date' }], icon: 'card', description: 'Payment collection' },
    { name: 'Blank Register', columns: [], icon: 'document', description: 'Start from scratch' },
  ],
  event: [
    { name: 'Guest List', columns: [{ name: 'Name', type: 'text' }, { name: 'RSVP', type: 'dropdown' }, { name: 'Seats', type: 'number' }, { name: 'Meal Pref', type: 'dropdown' }, { name: 'Status', type: 'dropdown' }, { name: 'Notes', type: 'text' }], icon: 'people', description: 'Attendee list' },
    { name: 'Vendor Log', columns: [{ name: 'Vendor', type: 'text' }, { name: 'Service', type: 'text' }, { name: 'Amount', type: 'number' }, { name: 'Paid', type: 'number' }, { name: 'Balance', type: 'number' }, { name: 'Date', type: 'date' }], icon: 'shield-checkmark', description: 'Vendor management' },
    { name: 'Schedule', columns: [{ name: 'Event', type: 'text' }, { name: 'Date', type: 'date' }, { name: 'Time', type: 'text' }, { name: 'Venue', type: 'text' }, { name: 'Owner', type: 'text' }, { name: 'Status', type: 'dropdown' }], icon: 'time', description: 'Event timeline' },
    { name: 'Blank Register', columns: [], icon: 'document', description: 'Start from scratch' },
  ],
  restaurant: [
    { name: 'Daily Menu', columns: [{ name: 'Item', type: 'text' }, { name: 'Category', type: 'text' }, { name: 'Price', type: 'number' }, { name: 'Available', type: 'dropdown' }, { name: 'Qty Made', type: 'number' }, { name: 'Sold', type: 'number' }], icon: 'restaurant', description: 'Menu items' },
    { name: 'Order Log', columns: [{ name: 'Table/Name', type: 'text' }, { name: 'Item', type: 'text' }, { name: 'Qty', type: 'number' }, { name: 'Rate', type: 'number' }, { name: 'Total', type: 'number' }, { name: 'Status', type: 'dropdown' }], icon: 'document-text', description: 'Customer orders' },
    { name: 'Expense Log', columns: [{ name: 'Date', type: 'date' }, { name: 'Category', type: 'text' }, { name: 'Amount', type: 'number' }, { name: 'Paid By', type: 'text' }, { name: 'Notes', type: 'text' }], icon: 'receipt', description: 'Kitchen expenses' },
    { name: 'Blank Register', columns: [], icon: 'document', description: 'Start from scratch' },
  ],
  fitness: [
    { name: 'Member Register', columns: [{ name: 'Name', type: 'text' }, { name: 'Phone', type: 'text' }, { name: 'Plan', type: 'text' }, { name: 'Start Date', type: 'date' }, { name: 'End Date', type: 'date' }, { name: 'Status', type: 'dropdown' }], icon: 'barbell', description: 'Gym members' },
    { name: 'Attendance', columns: [{ name: 'Member', type: 'text' }, { name: 'Date', type: 'date' }, { name: 'Check In', type: 'text' }, { name: 'Check Out', type: 'text' }, { name: 'Activity', type: 'text' }], icon: 'checkmark-circle', description: 'Member check-ins' },
    { name: 'Fee Collection', columns: [{ name: 'Member', type: 'text' }, { name: 'Month', type: 'text' }, { name: 'Amount', type: 'number' }, { name: 'Paid Date', type: 'date' }, { name: 'Receipt', type: 'text' }, { name: 'Balance', type: 'number' }], icon: 'cash', description: 'Membership fees' },
    { name: 'Blank Register', columns: [], icon: 'document', description: 'Start from scratch' },
  ],
  apartment: [
    { name: 'Flat Register', columns: [{ name: 'Flat No', type: 'text' }, { name: 'Owner', type: 'text' }, { name: 'Tenant', type: 'text' }, { name: 'Floor', type: 'text' }, { name: 'Type', type: 'text' }, { name: 'Status', type: 'dropdown' }], icon: 'business', description: 'Resident list' },
    { name: 'Maintenance', columns: [{ name: 'Flat No', type: 'text' }, { name: 'Month', type: 'text' }, { name: 'Amount', type: 'number' }, { name: 'Paid Date', type: 'date' }, { name: 'Receipt', type: 'text' }, { name: 'Balance', type: 'number' }], icon: 'construct', description: 'Maintenance fees' },
    { name: 'Visitor Log', columns: [{ name: 'Name', type: 'text' }, { name: 'Flat No', type: 'text' }, { name: 'Date', type: 'date' }, { name: 'Time In', type: 'text' }, { name: 'Time Out', type: 'text' }, { name: 'Purpose', type: 'text' }], icon: 'document-text', description: 'Security log' },
    { name: 'Blank Register', columns: [], icon: 'document', description: 'Start from scratch' },
  ],
  insurance: [
    { name: 'Client Register', columns: [{ name: 'Name', type: 'text' }, { name: 'Phone', type: 'text' }, { name: 'Policy No', type: 'text' }, { name: 'Type', type: 'text' }, { name: 'Premium', type: 'number' }, { name: 'Due Date', type: 'date' }], icon: 'people', description: 'Policy holders' },
    { name: 'Premium Log', columns: [{ name: 'Client', type: 'text' }, { name: 'Policy No', type: 'text' }, { name: 'Amount', type: 'number' }, { name: 'Due Date', type: 'date' }, { name: 'Paid Date', type: 'date' }, { name: 'Status', type: 'dropdown' }], icon: 'cash', description: 'Premium payments' },
    { name: 'Claim Register', columns: [{ name: 'Client', type: 'text' }, { name: 'Policy No', type: 'text' }, { name: 'Claim Date', type: 'date' }, { name: 'Amount', type: 'number' }, { name: 'Status', type: 'dropdown' }, { name: 'Remarks', type: 'text' }], icon: 'document', description: 'Insurance claims' },
    { name: 'Blank Register', columns: [], icon: 'document', description: 'Start from scratch' },
  ],
  farming: [
    { name: 'Crop Register', columns: [{ name: 'Crop', type: 'text' }, { name: 'Field', type: 'text' }, { name: 'Area', type: 'number' }, { name: 'Sown Date', type: 'date' }, { name: 'Harvest Date', type: 'date' }, { name: 'Status', type: 'dropdown' }], icon: 'leaf', description: 'Crop tracking' },
    { name: 'Expense Log', columns: [{ name: 'Date', type: 'date' }, { name: 'Category', type: 'text' }, { name: 'Crop', type: 'text' }, { name: 'Amount', type: 'number' }, { name: 'Paid By', type: 'text' }, { name: 'Notes', type: 'text' }], icon: 'receipt', description: 'Farm expenses' },
    { name: 'Yield Log', columns: [{ name: 'Crop', type: 'text' }, { name: 'Field', type: 'text' }, { name: 'Harvest Date', type: 'date' }, { name: 'Qty', type: 'number' }, { name: 'Unit', type: 'text' }, { name: 'Price', type: 'number' }], icon: 'leaf', description: 'Harvest yields' },
    { name: 'Blank Register', columns: [], icon: 'document', description: 'Start from scratch' },
  ],
  travel: [
    { name: 'Booking Register', columns: [{ name: 'Client', type: 'text' }, { name: 'Destination', type: 'text' }, { name: 'Travel Date', type: 'date' }, { name: 'Return Date', type: 'date' }, { name: 'Amount', type: 'number' }, { name: 'Status', type: 'dropdown' }], icon: 'airplane', description: 'Travel bookings' },
    { name: 'Expense Log', columns: [{ name: 'Date', type: 'date' }, { name: 'Category', type: 'text' }, { name: 'Description', type: 'text' }, { name: 'Amount', type: 'number' }, { name: 'Paid By', type: 'text' }, { name: 'Notes', type: 'text' }], icon: 'receipt', description: 'Trip expenses' },
    { name: 'Itinerary', columns: [{ name: 'Day', type: 'text' }, { name: 'Date', type: 'date' }, { name: 'Activity', type: 'text' }, { name: 'Location', type: 'text' }, { name: 'Time', type: 'text' }, { name: 'Notes', type: 'text' }], icon: 'map', description: 'Trip schedules' },
    { name: 'Blank Register', columns: [], icon: 'document', description: 'Start from scratch' },
  ],
  wholesaler: [
    { name: 'Stock Register', columns: [{ name: 'Item', type: 'text' }, { name: 'Category', type: 'text' }, { name: 'Qty', type: 'number' }, { name: 'Unit', type: 'text' }, { name: 'Rate', type: 'number' }, { name: 'Supplier', type: 'text' }], icon: 'cube', description: 'Inventory tracking' },
    { name: 'Sales Log', columns: [{ name: 'Date', type: 'date' }, { name: 'Customer', type: 'text' }, { name: 'Item', type: 'text' }, { name: 'Qty', type: 'number' }, { name: 'Rate', type: 'number' }, { name: 'Total', type: 'number' }], icon: 'trending-up', description: 'Wholesale orders' },
    { name: 'Purchase Log', columns: [{ name: 'Date', type: 'date' }, { name: 'Supplier', type: 'text' }, { name: 'Item', type: 'text' }, { name: 'Qty', type: 'number' }, { name: 'Rate', type: 'number' }, { name: 'Total', type: 'number' }], icon: 'download', description: 'Supplier purchases' },
    { name: 'Blank Register', columns: [], icon: 'document', description: 'Start from scratch' },
  ],
};
