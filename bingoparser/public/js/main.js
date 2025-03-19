// Format numbers with appropriate decimal places
function formatNumber(number, decimals = 8) {
    return parseFloat(number).toFixed(decimals);
}

// Update probability bars with animation
function updateProbabilityBars() {
    document.querySelectorAll('[data-probability]').forEach(bar => {
        const probability = parseFloat(bar.dataset.probability);
        bar.style.width = `${probability * 100}%`;
    });
}

// Format timestamps to local time
function formatTimestamp(timestamp) {
    return new Date(timestamp).toLocaleString();
}

// Add hover effects to table rows
document.querySelectorAll('table tbody tr').forEach(row => {
    row.addEventListener('mouseenter', () => {
        row.classList.add('bg-gray-800');
    });
    row.addEventListener('mouseleave', () => {
        row.classList.remove('bg-gray-800');
    });
});

// Handle refresh button click
const refreshButton = document.getElementById('refreshData');
if (refreshButton) {
    refreshButton.addEventListener('click', () => {
        refreshButton.disabled = true;
        refreshButton.innerHTML = '<span class="animate-spin">↻</span> Refreshing...';
        location.reload();
    });
}

// Auto-refresh data every 5 minutes
let refreshInterval = 300000; // 5 minutes
let refreshTimer;

function startAutoRefresh() {
    refreshTimer = setInterval(() => {
        location.reload();
    }, refreshInterval);
}

function stopAutoRefresh() {
    clearInterval(refreshTimer);
}

// Start auto-refresh when page loads
startAutoRefresh();

// Stop auto-refresh when page is not visible
document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
        stopAutoRefresh();
    } else {
        startAutoRefresh();
    }
});

// Form validation for admin panel
const userForm = document.getElementById('createUserForm');
if (userForm) {
    userForm.addEventListener('submit', (e) => {
        const password = document.getElementById('password').value;
        if (password.length < 8) {
            e.preventDefault();
            alert('Password must be at least 8 characters long');
        }
    });
}

// Show/hide password toggle
document.querySelectorAll('.password-toggle').forEach(toggle => {
    toggle.addEventListener('click', () => {
        const input = toggle.previousElementSibling;
        const type = input.getAttribute('type');
        input.setAttribute('type', type === 'password' ? 'text' : 'password');
        toggle.textContent = type === 'password' ? '👁️' : '👁️‍🗨️';
    });
});

// Initialize tooltips
const tooltips = document.querySelectorAll('[data-tooltip]');
tooltips.forEach(tooltip => {
    tooltip.addEventListener('mouseenter', (e) => {
        const tip = document.createElement('div');
        tip.className = 'tooltip bg-gray-900 text-white px-2 py-1 rounded text-sm absolute z-10';
        tip.textContent = e.target.dataset.tooltip;
        document.body.appendChild(tip);
        
        const rect = e.target.getBoundingClientRect();
        tip.style.top = `${rect.top - tip.offsetHeight - 5}px`;
        tip.style.left = `${rect.left + (rect.width - tip.offsetWidth) / 2}px`;
    });
    
    tooltip.addEventListener('mouseleave', () => {
        document.querySelector('.tooltip')?.remove();
    });
});

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    updateProbabilityBars();
});