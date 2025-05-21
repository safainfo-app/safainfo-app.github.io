import config from './config.js';  // Import configuration file
import { getValidPages, sha1Hash } from './page-utils.js';

// Initialize TinyMCE editor function
function initTinyMCE() {
    const MAX_LENGTH = 45000; // Maximum length for HTML content
    tinymce.init({
        selector: '#content',
        plugins: 'advlist autolink lists link image charmap preview anchor searchreplace visualblocks code fullscreen insertdatetime media table help',
        toolbar: 'undo redo | bold italic underline strikethrough | alignleft aligncenter alignright alignjustify | bullist numlist outdent indent | link image media table | code preview',
        height: 400,
        branding: false,
        setup: function (editor) {
            editor.on('beforeinput', function (e) {
                const content = editor.getContent({format: 'html'});
                if (content.length >= MAX_LENGTH && e.inputType !== 'deleteContentBackward') {
                    e.preventDefault();
                    editor.notificationManager.open({
                        text: `Limite massimo di ${MAX_LENGTH} caratteri HTML raggiunto!`,
                        type: 'warning',
                        timeout: 2000
                    });
                }
            });
            // Handle paste event to limit the length of pasted content
            editor.on('paste', function (e) {
                const clipboardData = (e.clipboardData || window.clipboardData);
                let pastedData = clipboardData ? clipboardData.getData('text/html') || clipboardData.getData('text/plain') : '';
                const content = editor.getContent({format: 'html'});
                // Calcola quanti caratteri restano disponibili
                const remaining = MAX_LENGTH - content.length;
                if (remaining <= 0) {
                    e.preventDefault();
                    editor.notificationManager.open({
                        text: `Limite massimo di ${MAX_LENGTH} caratteri HTML raggiunto!`,
                        type: 'warning',
                        timeout: 2000
                    });
                } else if (pastedData && (content.length + pastedData.length > MAX_LENGTH)) {
                    e.preventDefault();
                    // Troncamento del testo incollato per rispettare il limite
                    let truncated = pastedData.substring(0, remaining);
                    editor.insertContent(truncated);
                    editor.notificationManager.open({
                        text: `Il testo incollato è stato troncato a ${MAX_LENGTH} caratteri HTML!`,
                        type: 'warning',
                        timeout: 2000
                    });
                }
            });
        }
    });
}

// Generate unique ID
function generateId() {
    return 'ID-' + crypto.randomUUID();
}

// Handle form submission
function handleFormSubmission() {
    document.getElementById('googleForm').addEventListener('submit', async function (event) {
        event.preventDefault();

        const formIdInput = document.getElementById(config.creationFormId).value.trim();
        if (!formIdInput) {
            alert("Please provide a valid Google Form ID.");
            return;
        }

        const formIdHash = await sha1Hash(formIdInput);
        if (formIdHash !== config.creationFormIdHsh) {
            alert("Password sbagliata!");
            return;
        }

        const formUrl = `https://docs.google.com/forms/d/e/${formIdInput}/formResponse`;
        const formData = new FormData();

        formData.append(config.idField, document.getElementById('id').value);
        formData.append(config.titleField, document.getElementById('title').value);
        formData.append(config.subtitleField, document.getElementById('subtitle').value);
        formData.append(config.contentField, tinymce.get('content').getContent().trim());
        formData.append(config.imageField, document.getElementById('image').value);
        formData.append(config.colourField, document.getElementById('colour').value);
        formData.append(config.externalLinkField, document.getElementById('externalLink').value);
        formData.append(config.customPageField, document.getElementById('customPage').value);
        formData.append(config.parentField, document.getElementById('parent').value);
        formData.append(config.categoryField, document.getElementById('category').value);

        fetch(formUrl, { method: "POST", body: formData, mode: "no-cors" })
            .then(() => {
                alert("Operazione compiuta!");
                document.getElementById('googleForm').reset();
                clearEditorContent();
                document.getElementById('id').value = generateId();
            })
            .catch(error => {
                alert("Errore: " + error);
            });
    });
}

// General function to disable or enable fields based on a condition
function toggleFields(triggerFieldId, condition, fieldsToToggle) {
    const triggerField = document.getElementById(triggerFieldId);

    triggerField.addEventListener('change', function () {
        const isConditionMet = condition(this.value);
        fieldsToToggle.forEach(fieldId => {
            const field = document.getElementById(fieldId);
            if (field) {
                if (isConditionMet) {
                    field.value = "";
                    field.setAttribute("disabled", "disabled");
                } else {
                    field.removeAttribute("disabled");
                }
            }
        });

        toggleEditorReadOnly(isConditionMet);
    });

    triggerField.dispatchEvent(new Event("change"));
}

function toggleEditorReadOnly(isReadOnly) {
    const editor = tinymce.get("content");
    if (editor) {
        editor.setContent("");
        editor.mode.set(isReadOnly ? "readonly" : "design");
    }
}

// Function to clear TinyMCE editor content
function clearEditorContent() {
    const editor = tinymce.get("content");
    if (editor) {
        editor.setContent("");
    }
}

// Populate the parent dropdown with filtered pages
async function populateDropdown() {
    const validPages = await getValidPages(true);

    console.log("Filtering pages for 'parent' dropdown...");

    // Filter out pages where external_link is not empty or custom_page is 'TRUE'
    const filteredPages = validPages.filter(page => {
        return !(page.external_link && page.external_link.trim() !== "" || page.custom_page === 'TRUE');
    });

    console.log(`Filtered out ${validPages.length - filteredPages.length} pages for the 'parent' dropdown.`);
    console.log(`Remaining ${filteredPages.length} pages will be added to the dropdown.`);

    const parentSelect = document.getElementById("parent");
    parentSelect.innerHTML = '<option value="">Select Parent</option>';

    filteredPages.forEach(page => {
        const option = document.createElement("option");
        option.value = page.id;
        option.textContent = page.title;
        parentSelect.appendChild(option);
    });

    console.log("Parent dropdown populated with filtered pages.");
}


// Function to get the ID from the URL
function getURLParameter(name) {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get(name);
}

// Function to fill the form with the data
function fillForm(data) {
    document.getElementById('id').value = data.ID;
    document.getElementById('title').value = data.title;
    document.getElementById('subtitle').value = data.subtitle || '';
    tinymce.get('content').setContent(data.content || '');
    document.getElementById('image').value = data.image_address || '';
    document.getElementById('externalLink').value = data.external_link || '';
    document.getElementById('colour').value = data.colour || '#ffffff';
    document.getElementById('customPage').value = data.custom_page || 'false';
    document.getElementById('parent').value = data.parent || '';
    document.getElementById('category').value = data.category || 'category1';
}

// Function to update the form based on the ID
async function updateForm() {
    const id = getURLParameter('id');
    if (!id) {
        console.error('No ID parameter found in the URL.');
        return;
    }

    try {
        const validPages = await getValidPages(true);
        const pageData = validPages.find(page => page.ID === id);

        if (pageData) {
            fillForm(pageData);
        } else {
            console.error('No page found with the given ID.');
        }
    } catch (error) {
        console.error('Error fetching valid pages:', error);
    }
}

// Main function to initialize everything
document.addEventListener("DOMContentLoaded", function () {
    initTinyMCE();
    const idField = document.getElementById('id');
    idField.value = generateId();
    handleFormSubmission();
    populateDropdown();

    // Handle the custom page selection: disable/enable fields based on custom page
    toggleFields("customPage", (value) => value === "true", [
        "subtitle", "content", "externalLink"
    ]);

    // Handle the external link field: disable/enable fields based on external link input
    toggleFields("externalLink", (value) => value.trim() !== "", [
        "subtitle", "content", "customPage", "category"
    ]);

    if (window.location.search.includes('id=')) {
        updateForm();  // Only call updateForm if there’s an ID in the URL (edit mode)
    }
});
