"""
Constants for e2e testing.
These values are used for both seeding test data and running tests.
"""

# Test user credentials
TEST_USER_EMAIL = "user@e2e-tests.com"
TEST_USER_PASSWORD = "Test123!"
TEST_USER_FIRST_NAME = "Test"
TEST_USER_LAST_NAME = "User"

# Test app configuration
TEST_APP_HASH_ID = "7cc04575-9e9c-4f"
TEST_APP_TITLE = "Every Type of Field"
TEST_APP_DESCRIPTION = "This app maxes out all the kinds of fields."

# Test app JSON - comprehensive app with all field types
TEST_APP_JSON = {
    "title": "Every Type of Field",
    "description": "This app maxes out all the kinds of fields. ",
    "collection": 174,
    "privacySettings": "public",
    "clonable": True,
    "attachedFiles": [],
    "aiConfig": {
        "aiModel": "gpt-4o-mini",
        "temperature": 0.7,
        "maxResponseTokens": None,
        "systemPrompt": ""
    },
    "elements": [
        {
            "id": "title-1769113533689",
            "name": "title1",
            "text": "Let's Begin!",
            "type": "title",
            "label": "Let's Begin!",
            "isRequired": False
        },
        {
            "id": "chat-1769642539771",
            "name": "chat1",
            "type": "chat",
            "label": "Question",
            "avatarUrl": "",
            "enableTts": True,
            "isRequired": False,
            "maxMessages": 10,
            "ttsProvider": "openai",
            "initialMessage": "Hello! How can I help you today?",
            "selectedVoiceId": "shimmer",
            "voiceInstructions": ""
        },
        {
            "id": "richText-1769113131028",
            "html": "<p><strong>Hey!</strong> Welcome to this app. </p><p>Here, we'll test all the fields: </p><ul><li><p>Text Fields</p></li><li><p>Selection Fields</p></li><li><p>Image Upload fields...</p></li></ul><p>And <span style=\"color: rgb(84, 155, 43);\">more!</span></p><img src=\"https://dd9g540oafzd5.cloudfront.net/microapps/477/images/American-toad_1769113213750.webp\" alt=\"American-toad\">",
            "name": "richText1",
            "type": "richText",
            "label": "",
            "isRequired": False
        },
        {
            "id": "text-1769113061881",
            "name": "name",
            "text": "What is your name?",
            "type": "text",
            "label": "What is your name?",
            "maxChars": 20,
            "isRequired": False,
            "description": "frf"
        },
        {
            "id": "textarea-1769113090428",
            "name": "hobbies",
            "text": "What are your hobbies? ",
            "type": "textarea",
            "label": "What are your hobbies? ",
            "minChars": 10,
            "isRequired": False,
            "description": "Must be more than 10 characters"
        },
        {
            "id": "radio-1769113255334",
            "name": "languages",
            "text": "What is your native language?",
            "type": "radio",
            "label": "What is your native language?",
            "choices": [
                {
                    "text": "English",
                    "value": "Item 1"
                },
                {
                    "text": "Spanish",
                    "value": "Item 2"
                },
                {
                    "text": "French",
                    "value": "Item 3"
                },
                {
                    "text": "Ukranian",
                    "value": "Item 4"
                }
            ],
            "isRequired": False,
            "showOtherItem": True
        },
        {
            "id": "checkbox-1769113306357",
            "name": "pets",
            "text": "Which these pets do you have? ",
            "type": "checkbox",
            "label": "Which these pets do you have? ",
            "choices": [
                {
                    "text": "Dog",
                    "value": "Item 1"
                },
                {
                    "text": "Cat",
                    "value": "Item 2"
                },
                {
                    "text": "Fish",
                    "value": "Item 3"
                }
            ],
            "isRequired": False,
            "description": "Choose as many as apply. ",
            "showOtherItem": True
        },
        {
            "id": "dropdown-1769113405387",
            "name": "dropdown1",
            "text": "Do you like the Marvel movies?",
            "type": "dropdown",
            "label": "Do you like the Marvel movies?",
            "choices": [
                {
                    "text": "Yes",
                    "value": "Item 1"
                },
                {
                    "text": "No",
                    "value": "Item 2"
                },
                {
                    "text": "Sometimes",
                    "value": "Item 3"
                }
            ],
            "isRequired": False,
            "showOtherItem": True,
            "conditionalLogic": {
                "value": "test",
                "operator": "not_equals",
                "sourceFieldId": "text-1769113061881"
            }
        },
        {
            "id": "slider-1769113449334",
            "name": "siblings",
            "text": "How many siblings do you have?",
            "type": "slider",
            "label": "How many siblings do you have?",
            "maxValue": 10,
            "isRequired": False,
            "defaultValue": 0
        },
        {
            "id": "boolean-1769113478665",
            "name": "spicy",
            "text": "Do you like spicy food? ",
            "type": "boolean",
            "label": "Do you like spicy food? ",
            "isRequired": False,
            "defaultValue": True
        },
        {
            "id": "imageUpload-1769113503242",
            "name": "imageUpload1",
            "text": "Please upload an image of a cat.",
            "type": "imageUpload",
            "label": "Please upload an image of a cat.",
            "maxFiles": 1,
            "multiple": False,
            "isRequired": False,
            "description": "It must be of a cat. Any style is fine, as long as it is a cat. ",
            "maxFileSize": 5,
            "allowedFileTypes": [
                "image/jpeg",
                "image/png",
                "image/webp"
            ]
        },
        {
            "id": "fixedResponse-1769113571448",
            "name": "fixedResponse1",
            "text": "OK, now that you've provided those   answers,  let's have  {siblings}  the AI w  rite a story about you.&nbsp;  {name}  ",
            "type": "fixedResponse",
            "label": "",
            "isRequired": False
        },
        {
            "id": "aiResponse-1769113592377",
            "name": "aiResponse111",
            "type": "aiResponse",
            "label": "",
            "isRequired": False,
            "instructions": [
                {
                    "text": " I will gi {name} ve you some details about me. Please repeat them back to me.&nbsp;<br>Name:&nbsp;  <br>Hobbies:&nbsp; <span contenteditable=\"false\" draggable=\"true\" data-tag-id=\"textarea-1769113090428\" data-tag-label=\"hobbies\" class=\"inline-flex items-center align-baseline px-2 py-0.5 rounded-full text-sm text-white cursor-move bg-primary-600\" style=\"margin: 0 0.25em;\">h  obbies</span> <div>Native Language:&nbsp;  {languages}  <br>Pet(s) I have:&nbsp; {pets} <br>Do I like the Marvel Movies?:&nbsp;  {dropdown1}  <br># of Siblings I have:&nbsp; {siblings}<br></div>"
                },
                {
                    "text": "Do I like Spicy Food?: Yes",
                    "conditionalLogic": {
                        "value": True,
                        "operator": "equals",
                        "sourceFieldId": "boolean-1769113478665"
                    }
                },
                {
                    "text": "Do I like Spicy Food?: No",
                    "conditionalLogic": {
                        "value": True,
                        "operator": "not_equals",
                        "sourceFieldId": "boolean-1769113478665"
                    }
                }
            ]
        },
        {
            "id": "aiResponse-1769113874524",
            "name": "aiResponse2",
            "type": "aiResponse",
            "label": "",
            "isRequired": False,
            "instructions": [
                {
                    "text": "Determine if this is an image of a cat:&nbsp; {imageUpload1} "
                }
            ]
        },
        {
            "id": "scoring-1769180100320",
            "name": "scoring1",
            "type": "scoring",
            "label": "",
            "rubric": "[{\"criteria\":\"Name\",\"lines\":[{\"score\":1,\"description\":\"The user's name in this conversation is John\"},{\"score\":0,\"description\":\"The user's name in this conversation is not John. Or, you don't know the users name from the conversation. \"}]},{\"criteria\":\"Hobbies\",\"lines\":[{\"score\":1,\"description\":\"The user's hobbies include golf OR crossword puzzles\"},{\"score\":0,\"description\":\"The user's hobbies do not include golf NOR crossword puzzles, or you don't know their hobbies based on this conversation. \"},{\"score\":2,\"description\":\"The user's hobbies include golf AND crossword puzzles. \"}]}]",
            "minScore": 1,
            "isRequired": True
        },
        {
            "id": "textarea-1769527790396",
            "name": "textarea1",
            "text": "Question",
            "type": "textarea",
            "label": "Question",
            "isRequired": False,
            "placeholder": "jughiuij"
        },
        {
            "id": "aiResponse-1769527806180",
            "name": "airesponse3",
            "type": "aiResponse",
            "label": "",
            "isRequired": False,
            "instructions": [
                {
                    "text": "test {richText1} "
                }
            ]
        },
        {
            "id": "textarea-1769528490655",
            "name": "textarea2",
            "text": "Question",
            "type": "textarea",
            "label": "Question",
            "isRequired": False
        },
        {
            "id": "textarea-1769528506616",
            "name": "textarea3",
            "text": "Question",
            "type": "textarea",
            "label": "Question",
            "isRequired": False
        },
        {
            "id": "textarea-1769528540127",
            "name": "textarea4",
            "type": "textarea",
            "label": "Question",
            "isRequired": False
        },
        {
            "id": "text-1769528582286",
            "name": "text1",
            "type": "text",
            "label": "Question",
            "isRequired": False
        },
        {
            "id": "text-1769531696670",
            "name": "text2",
            "type": "text",
            "label": "Question",
            "isRequired": False
        },
        {
            "id": "text-1769531712990",
            "name": "text3",
            "type": "text",
            "label": "Question",
            "isRequired": False
        }
    ]
}

