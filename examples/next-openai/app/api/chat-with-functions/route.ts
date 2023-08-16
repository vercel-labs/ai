import { Configuration, OpenAIApi } from 'openai-edge'
import {
  COMPLEX_HEADER,
  OpenAIStream,
  StreamingTextResponse,
  experimental_StreamData
} from 'ai'
import { ChatCompletionFunctions } from 'openai-edge/types/api'

// Create an OpenAI API client (that's edge friendly!)
const config = new Configuration({
  apiKey: process.env.OPENAI_API_KEY
})
const openai = new OpenAIApi(config)

// IMPORTANT! Set the runtime to edge
export const runtime = 'edge'

const functions: ChatCompletionFunctions[] = [
  {
    name: 'get_current_weather',
    description: 'Get the current weather.',
    parameters: {
      type: 'object',
      properties: {
        format: {
          type: 'string',
          enum: ['celsius', 'fahrenheit'],
          description:
            'The temperature unit to use.'
        }
      },
      required: ['format']
    }
  },
  {
    name: 'eval_code_in_browser',
    description: 'Execute javascript code in the browser with eval().',
    parameters: {
      type: 'object',
      properties: {
        code: {
          type: 'string',
          description: `Javascript code that will be directly executed via eval(). Do not use backticks in your response.
           DO NOT include any newlines in your response, and be sure to provide only valid JSON when providing the arguments object.
           The output of the eval() will be returned directly by the function.`
        }
      },
      required: ['code']
    }
  }
]

export async function POST(req: Request) {
  const { messages } = await req.json()
  console.log(messages)

  const response = await openai.createChatCompletion({
    model: 'gpt-3.5-turbo-0613',
    stream: true,
    messages,
    functions
  })

  const data = new experimental_StreamData()
  const stream = OpenAIStream(response, {
    experimental_onFunctionCall: async (
      { name, arguments: args },
      createFunctionCallMessages
    ) => {
      if (name === 'get_current_weather') {
        // Call a weather API here
        const weatherData = {
          temperature: 20,
          unit: args.format === 'celsius' ? 'C' : 'F'
        }

        data.append({
          text: 'Some custom data'
        })

        return openai.createChatCompletion({
          model: 'gpt-3.5-turbo-0613',
          stream: true,
          messages: [...messages, ...createFunctionCallMessages(weatherData)]
        })
      }
    },
    onCompletion(completion) {
      console.log('!!!!', completion)
    },
    onFinal(completion) {
      console.log('????', completion)
      data.close()
    },
    experimental_streamData: true
  })

  data.append({
    text: 'Hello, how are you?'
  })

  return new StreamingTextResponse(
    stream,
    {
      headers: {
        [COMPLEX_HEADER]: 'true'
      }
    },
    data
  )
}
