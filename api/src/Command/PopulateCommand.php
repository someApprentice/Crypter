<?php
namespace Crypter\Command;

use Symfony\Component\Console\Command\Command;
use Symfony\Component\Console\Input\InputInterface;
use Symfony\Component\Console\Input\InputOption;
use Symfony\Component\Console\Output\OutputInterface;
use Symfony\Component\Console\Helper\ProgressBar;

use GuzzleHttp\Client;

class PopulateCommand extends Command
{
    protected static $defaultName = 'crypter:populate';

    protected function configure() {
        $this
            ->setDescription('Populate database with conferences between alice@crypter.com, bob@crypter.com, tester@crypter.com (passwords for each one is "password")')
            ->setHelp('Populate database with conferences between alice@crypter.com, bob@crypter.com, tester@crypter.com (passwords for each one is "password")')
        ;
    }

    public function __construct(bool $requirePassword = false)
    {
        $this->requirePassword = $requirePassword;

        parent::__construct();

        $this->addOption(
            'iterations',
            'i',
            InputOption::VALUE_REQUIRED,
            'How many messages should be between users?',
            100
        );
    }

    protected function execute(InputInterface $input, OutputInterface $output)
    {
        $client = new Client([
            'base_uri' => 'http://localhost'
        ]);

        $output->writeln('Populate Alice');

        $response = $client->request(
            $method = 'POST',
            $uri = '/api/auth/registrate',
            $options = [
                'headers' => [
                    'CONTENT_TYPE' => 'application/json'
                ],
                'json' => [
                    'email' => 'alice@crypter.com',
                    'name' => 'Alice',
                    'password' => 'password'
                ]
            ],
            // $files = [],
            // $server = [
            //     'CONTENT_TYPE' => 'application/json'
            // ]
        );

        $alice = json_decode($response->getBody(), $assoc = true);


        $output->writeln('Populate Bob');

        $response = $client->request(
            $method = 'POST',
            $uri = '/api/auth/registrate',
            $options = [
                'json' => [
                    'email' => 'bob@crypter.com',
                    'name' => 'Bob',
                    'password' => 'password'
                ]
            ],
            // $files = [],
            // $server = [
            //     'CONTENT_TYPE' => 'application/json'
            // ]
        );

        $bob = json_decode($response->getBody(), $assoc = true);


        $output->writeln('Populate Tester');

        $response = $client->request(
            $method = 'POST',
            $uri = '/api/auth/registrate',
            $options = [
                'headers' => [
                    'CONTENT_TYPE' => 'application/json'
                ],
                'json' => [
                    'email' => 'tester@crypter.com',
                    'name' => 'Tester',
                    'password' => 'password'
                ]
            ],
            // $files = [],
            // $server = [
            //     'CONTENT_TYPE' => 'application/json'
            // ]
        );

        $tester = json_decode($response->getBody(), $assoc = true);


        $progress = new ProgressBar($output, $input->getOption('iterations') * 2);        
        $progress->start();


        $progress->setMessage('Message population\'s progress between Alice and Bob');

        for ($i = 0; $i < $input->getOption('iterations'); $i++) {
            $client->request(
                $method = 'POST',
                $uri = "/api/messenger/message/{$bob['uuid']}",
                $options = [
                    'headers' => [
                        'Authorization' => "Bearer {$alice['jwt']}",
                        'CONTENT_TYPE' => 'application/json'
                    ],
                    'json' => [
                        'text' => 'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.'
                    ]
                ],
                // $files = [],
                // $server = [
                //     'HTTP_AUTHORIZATION' => "Bearer {$alice['jwt']}",
                //     'CONTENT_TYPE' => 'application/json'
                // ]
            );

            $progress->advance();            
        }


        $progress->setMessage('Message population\'s progress between Bob and Tester');

        for ($i = 0; $i < $input->getOption('iterations'); $i++) {
            $client->request(
                $method = 'POST',
                $uri = "/api/messenger/message/{$bob['uuid']}",
                $options = [
                    'headers' => [
                        'Authorization' => "Bearer {$tester['jwt']}",
                        'CONTENT_TYPE' => 'application/json'
                    ],
                    'json' => [
                        'text' => 'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.'
                    ]
                ],
                // $files = [],
                // $server = [
                //     'HTTP_AUTHORIZATION' => "Bearer {$tester['jwt']}",
                //     'CONTENT_TYPE' => 'application/json'
                // ]
            );

            $progress->advance();
        }


        $progress->finish();

        $output->writeln('');
    }
}